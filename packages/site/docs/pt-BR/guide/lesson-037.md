---
outline: deep
description: 'Explore o Radiance Cascades e implemente iluminação global em tempo real. Aprenda técnicas avançadas de iluminação e otimização de desempenho na renderização moderna.'
---

<script setup>
import RadianceCascades from '../../components/RadianceCascades.vue'
</script>

# Lição 37 - GI com Radiance Cascades {#lesson-37-gi-with-radiance-cascades}

Na [Lição 35 - Renderização baseada em tiles], usamos o renderizador [vello] baseado em Compute Shader de WebGPU. Nesta lição, vamos experimentar uma abordagem de iluminação global também baseada em compute shader e integrá-la ao pipeline de renderização existente.

<RadianceCascades />

Para uma explicação completa da teoria, veja: [Fundamentals of Radiance Cascades]

> O que observamos é que, quanto mais longe estamos do objeto mais próximo na cena:
>
> -   Menos resolução espacial precisamos. (por exemplo, o espaçamento entre as sondas pode ser maior)
> -   Mais resolução angular precisamos. (por exemplo, precisamos de mais raios por sonda)

![fonte: https://arxiv.org/pdf/2408.14425](/rc-penumbra.png)

O pipeline geral é:

```rust
let mut rc_enc = device_handle
    .device
    .create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("rc_gi"),
    });
rp.encode_distance_pass();
rp.encode_rc_cascade_passes();
rp.encode_rc_mipmap();
rp.encode_rc_apply();
device_handle.queue.submit([rc_enc.finish()]);
```

## Gerar o campo de distância {#distance-pass}

Começamos com geometria analítica. Na [Lição 2 - Desenhar um círculo] e na [Lição 9 - Desenhar elipse e retângulo], já apresentamos SDFs de círculos, elipses e retângulos. A distância é `0` nas bordas das formas e dentro delas. A figura abaixo visualiza isso em escala de cinza, mapeando a distância bruta para `[0,1]` com `saturate(d * DIST_FIELD_VIZ_SCALE)`:

![SDF de retângulo e elipse](/rc-sdf.png)

Para gerar a textura do campo de distância, o vertex shader ainda usa um triângulo de tela cheia (semelhante aos nossos passes anteriores de pós-processamento). `prims` armazena a geometria primitiva básica da cena, para que `sdf_prim` possa avaliar campos de distância analíticos. O resultado final é escrito em `rc_dist`, uma textura que cobre a tela inteira no formato `R16F` e armazena a distância sem sinal.

```wgsl
@group(0) @binding(0) var<uniform> header: DistHeader;
@group(0) @binding(1) var<storage, read> prims: array<GpuRcPrim>;

@fragment
fn dist_fs(i: VsOut) -> @location(0) vec4<f32> {
  var d = 1e6;
  let n = header.count;
  for (var i = 0u; i < 64u; i = i + 1u) {
    if i >= n { break; }
    d = min(d, sdf_prim(p_canvas, prims[i]));
  }
  // d is union SDF: inside <0, outside >0, boundary ~=0. R stores max(d,0): 0 inside and on edges, positive outside as distance to boundary.
  return vec4(max(d, 0.0), 0.0, 0.0, 1.0);
}
```

Por enquanto, só suportamos Rect, Ellipse, Line e Polyline. Para outros SDFs, consulte [distfunctions2d].

### JFA {#jfa}

A implementação do [bevy_radiance_cascades] usa o Jump Flood Algorithm (JFA), um método paralelo para gerar campos de distância. A ideia central é propagar a informação por toda a grade em `log₂(N)` rodadas, com “passos de salto” que diminuem exponencialmente.

-   Entrada: JFA `texture_2d<u32>` (armazena as coordenadas da semente).
-   Saída: distância euclidiana do pixel atual até a semente, escrita em um mapa de distância R16Float.

Isso permite que o raymarch dê passos grandes e seguros até a próxima superfície, em vez de usar passos minúsculos fixos.

## Calcular cascatas {#cascade-compute}

[Fundamentals of Radiance Cascades]

> Uma cascata é basicamente uma grade de sondas, na qual todas as sondas têm as mesmas propriedades. (por exemplo, quantidade de intervalos, comprimento do intervalo, espaçamento das sondas)

<video autoplay="" class="video" loop="" muted="" playsinline="" style="width:360px"><source src="https://m4xc.dev/anim/articles/fundamental-rc/spatial-exploit-anim.mp4" type="video/mp4"> A tag de vídeo não é suportada.</video>

Cada Probe tem a seguinte estrutura. Ao enviar para a GPU com alinhamento std140, o padding precisa ser levado em conta:

```rust
pub struct Probe {
    pub width: u32, // texel footprint per probe and ray count (angular discretization)
    pub start: f32, // where this ray segment starts from the probe center
    pub range: f32, // how far this cascade traces along the ray from start
}

pub fn probe_for_cascade(c: u32, resolution_factor: u32, interval0: f32) -> Probe {
    let width = 1u32 << (c + resolution_factor);
    let start = interval0 * (1.0 - 4.0_f32.powi(c as i32)) / -3.0;
    let range = interval0 * 4.0_f32.powi(c as i32);
    Probe {
        width,
        start,
        range,
    }
}
```

![Aumento da resolução angular para “anéis” mais distantes. fonte: https://m4xc.dev/articles/fundamental-rc/](https://m4xc.dev/img/articles/fundamental-rc/inc-angular-split.png)

Calcule a quantidade necessária de cascatas a partir do comprimento da diagonal da tela:

```rust
pub fn cascade_count_for_gi_size(gi_w: u32, gi_h: u32) -> usize {
    let diag = ((gi_w * gi_w + gi_h * gi_h) as f32).sqrt();
    cascade_count_for_diagonal(diag, RC_INTERVAL0, RC_MAX_CASCADES).max(1)
}

pub const RC_INTERVAL0: f32 = 2.0;
pub const RC_MAX_CASCADES: usize = 16;
```

Aloque os uniforms de Probe ao inicializar a tela:

```rust
for c in 0..cascade_count {
    let p = probe_for_cascade(c as u32, RC_RESOLUTION_FACTOR, RC_INTERVAL0);
    let slot = ProbeUniformSlotPadded::from_probe(&p);
    queue.write_buffer(
        &self.rc_probe_dynamic_buf,
        (c * PROBE_UNIFORM_STRIDE) as u64,
        bytemuck::bytes_of(&slot),
    );
}
```

### Agendamento na CPU e ping-pong {#ping-pong}

O agendamento no lado da CPU se divide em dois pipelines e exige duas texturas: `rc_ping_a` e `rc_ping_b`.

```rust
let rc_usage =
    TextureUsages::STORAGE_BINDING | TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_SRC;
let (rc_a, rc_a_view) = mk_sz(
    device,
    "rc_ping_a",
    TextureFormat::Rgba16Float,
    rc_usage,
    gi_width,
    gi_height,
);
// rc_ping_b is the same
```

O primeiro pipeline lê `rc_ping_a` e escreve em `rc_ping_b`, começando pelo segmento mais distante.

```rust
let mut pass = encoder.begin_compute_pass(&ComputePassDescriptor {
    label: Some("radiance_cascades_first_pass"),
    timestamp_writes: None,
});
pass.set_pipeline(&self.rc_cascade_first_pipeline);
pass.set_bind_group(0, &radiance_cascades_10, &[first_offset]);
pass.dispatch_workgroups(gw, gh, 1);
```

O segundo pipeline alterna os bind groups `radiance_cascades_01 / 10` para o ping-pong (as escritas em `rc_ping_a` / `rc_ping_b` se revezam). Em seguida, mescla nível a nível em direção a um `c` menor, usando o offset de Probe correspondente em cada passo.

```rust
let mut merge_pass = encoder.begin_compute_pass(&ComputePassDescriptor {
    label: Some("radiance_cascades_merge_passes"),
    timestamp_writes: None,
});
merge_pass.set_pipeline(&self.rc_cascade_merge_pipeline);
for pass_i in 1..cascade_count {
    let cascade_idx = cascade_count - 1 - pass_i;
    let dyn_off = (cascade_idx * PROBE_UNIFORM_STRIDE) as u32;
    let merge_idx = pass_i - 1;
    let bg = if merge_idx % 2 == 0 {
        &radiance_cascades_01
    } else {
        &radiance_cascades_10
    };
    merge_pass.set_bind_group(0, bg, &[dyn_off]);
    merge_pass.dispatch_workgroups(gw, gh, 1);
}
```

Tanto o primeiro passe quanto os passes de compute seguintes do ping-pong usam a mesma lógica de despacho de raios.

```wgsl
@compute @workgroup_size(8, 8, 1)
fn rc_cascade_first(@builtin(global_invocation_id) gid: vec3<u32>) {
  radiance_dispatch(0u, gid);
}

@compute @workgroup_size(8, 8, 1)
fn rc_cascade_merge(@builtin(global_invocation_id) gid: vec3<u32>) {
  radiance_dispatch(1u, gid);
}
```

### Despachar raios {#dispatch-ray}

Cada thread do Compute Shader trata um texel na textura de cascata da GI:

1. Seleciona uma direção a partir da posição local dentro do bloco `width²`.
2. Usa a posição do bloco na textura completa para obter o centro da sonda em coordenadas de resolução total.
3. Desloca `start` ao longo do raio para obter o ponto inicial do raymarch.

Dentro de um bloco de sonda, texels diferentes representam direções diferentes; o bloco empacota `width²` amostras direcionais. O vídeo explicativo abaixo é de [Fundamentals of Radiance Cascades]:

<video class="video" loop="" muted="" playsinline="" style="width:360px" controls=""><source src="https://m4xc.dev/anim/articles/fundamental-rc/probe-memory-anim.mp4" type="video/mp4"> A tag de vídeo não é suportada.</video>

```wgsl
let probe_texel = vec2<u32>(base_coord.x % probe_w, base_coord.y % probe_w);

// Flatten 2D local coords into ray IDs in 0 … probe_w²-1.
let ray_index = probe_texel.x + probe_texel.y * probe_w;
let ray_count = probe_w * probe_w;

// Uniformly split [0, 2π) into ray_count directions.
// +0.5 samples the center of each angular sector.
let ray_angle = (f32(ray_index) + 0.5) / f32(ray_count) * PI2;
let ray_dir = normalize(vec2(cos(ray_angle), sin(ray_angle)));

// Probe row/column index this texel belongs to.
let probe_cell = vec2<u32>(base_coord.x / probe_w, base_coord.y / probe_w);
// Top-left coordinate of this probe in GI texture.
let probe_coord = vec2<u32>(probe_cell.x * probe_w, probe_cell.y * probe_w);
// Probe center in GI texture.
let probe_coord_center = probe_coord + vec2<u32>(probe_w / 2u, probe_w / 2u);
// Probe center in full resolution.
let center_full = vec2<f32>(probe_coord_center) * rs.gi_scale;
```

Se nenhum acerto for encontrado e a mesclagem estiver habilitada, some a radiância interpolada da cascata superior por meio de `merge()`.

```wgsl
@group(0) @binding(5) var tex_radiance_cascades_destination: texture_storage_2d<rgba16float, write>;

fn radiance_dispatch(merge_flag: u32, gid: vec3<u32>) {
  // ...

  // Start from center + ray_dir * probe.start, not exactly at center.
  // Inner cascades already cover near field; this cascade handles farther range only.
  let origin = center_full + ray_dir * ru.probe_start;
  var color = raymarch(origin, ray_dir, ru.probe_range);
  if merge_flag != 0u && color.a != 1.0 {
    color = color + merge(probe_cell, ray_index);
  }
  textureStore(tex_radiance_cascades_destination, ...);
}
```

### Raymarch {#raymarch}

Para cada raio que parte de um pixel e avança em uma direção, damos no máximo `MAX_RAYMARCH` passos. Em cada passo, amostramos o campo de distância gerado antes, `tex_dist_field`, e avançamos `dist`. Se a distância for `< EPSILON`, tratamos isso como um acerto em uma superfície (ou como estar dentro da geometria) e, então, amostramos `tex_main` diretamente para obter a cor.

```wgsl
fn raymarch(origin: vec2<f32>, ray_dir: vec2<f32>, range: f32) -> vec4<f32> {
    // ...
    var color = vec4(0.0);
    var covered_range = 0.0;
    for (var r = 0u; r < MAX_RAYMARCH; r = r + 1u) {
        if ( // termination
            covered_range >= range ||
            any(position >= dimensions)
        ) {
            break;
        }

        var dist = textureLoad(tex_dist_field, coord, 0).r;
        if (dist < EPSILON) {
            color = textureLoad(tex_main, coord, 0);
            break;
        }
        position = position + ray_dir * dist;
        covered_range = covered_range + dist;
    }
    return color;
}
```

### Mesclar cascatas {#merge-cascade}

“Mesclar da cascata interna (mais fina) para a camada atual”: se a largura atual da sonda é `W`, a cascata anterior (já escrita em `tex_radiance_cascades_source`) tem `prev_width = 2W`, isto é, 2× o comprimento da aresta da sonda e 4× amostras direcionais. Durante a mesclagem:

-   Mapeia 4 direções finas (`ray_index*4 … +3`) na direção grosseira atual.
-   Faz interpolação bilinear no espaço sobre a grade de sondas anterior, mais densa (TL/TR/BL/BR).

```wgsl
fn merge(probe_cell: vec2<u32>, ray_index: u32) -> vec4<f32> {
    let dimensions = textureDimensions(tex_radiance_cascades_source);
    // Probe edge length in previous cascade texture.
    // Current is W, previous is 2W, so previous has 4x rays.
    let prev_width = probe.width * 2u;

    let prev_ray_index_start = ray_index * 4u;
    for (var p = 0u; p < 4u; p = p + 1u) {
        let prev_ray_index = prev_ray_index_start + p;
        let offset_coord = vec2<u32>(
            prev_ray_index % prev_width,
            prev_ray_index / prev_width,
        );

        // Sample all four spatial corners
        TL = TL + fetch_cascade(
            probe_cell_i,
            probe_correction_offset + vec2<i32>(-1, -1),
            offset_coord,
            dimensions,
            prev_width,
        );
        // TR / BL / BR omitted
    }

    let weight = vec2<f32>(0.75, 0.75)
        - vec2<f32>(f32(probe_correction_offset.x), f32(probe_correction_offset.y)) * 0.5;
    // Bilinear interpolation over accumulated corner radiance.
    return mix(mix(TL, TR, weight.x), mix(BL, BR, weight.x), weight.y)
    // Average the 4 fine rays into one coarse-direction result.
        * 0.25;
}
```

![Mesclagem com 4 sondas bilineares. fonte: https://m4xc.dev/articles/fundamental-rc/](https://m4xc.dev/img/articles/fundamental-rc/bilinear-probes.png)

Com o WebGPU Inspector, você pode inspecionar o resultado final mesclado em `rc_ping_b`. Dá para ver com clareza que as áreas sem acerto são preenchidas, produzindo uma penumbra mais suave.

![Resultado mesclado](/rc-pingpong.png)

## mipmap {#mipmap}

Quando o espaçamento das sondas fica maior que a escala do detalhe da sombra, a interpolação borra os limites entre claro e escuro.

Calcule a média do resultado final da cascata sobre a grade de sondas e escreva em um `radiance_mipmap` com resolução reduzida.

```wgsl
@group(0) @binding(0) var<uniform> probe: MipmapProbe;
@group(0) @binding(1) var tex_radiance_cascades: texture_2d<f32>;
@group(0) @binding(2) var tex_radiance_mipmap: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn rc_radiance_mipmap(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let base_coord = global_id.xy;
  let dimensions = textureDimensions(tex_radiance_mipmap);
  if any(base_coord >= dimensions) {
    return;
  }
  let pw = probe.width;
  let ray_count = pw * 2u;
  let probe_cell = base_coord * vec2<u32>(pw, pw);
  var accumulation = vec4(0.0);
  for (var y = 0u; y < pw; y = y + 1u) {
    for (var x = 0u; x < pw; x = x + 1u) {
      let coord = vec2<i32>(i32(probe_cell.x + x), i32(probe_cell.y + y));
      accumulation = accumulation + textureLoad(tex_radiance_cascades, coord, 0);
    }
  }
  accumulation = accumulation / f32(ray_count);
  textureStore(tex_radiance_mipmap, vec2<i32>(base_coord), accumulation);
}
```

![Gerar mipmap](/rc-mipmap.png)

## Compor o resultado final {#composite}

`main + radiance_mipmap`: soma a iluminação indireta de volta à cor principal.

```wgsl
@group(0) @binding(0) var tex_main: texture_2d<f32>;
@group(0) @binding(1) var sampler_main: sampler;
@group(0) @binding(2) var tex_radiance_mipmap: texture_2d<f32>;
@group(0) @binding(3) var sampler_radiance_mipmap: sampler;

@fragment
fn rc_apply_fs(i: VsOut) -> @location(0) vec4<f32> {
  let uv = vec2(i.ndc.x * 0.5 + 0.5, 0.5 - i.ndc.y * 0.5);
  let main = textureSample(tex_main, sampler_main, uv);
  let radiance = textureSample(tex_radiance_mipmap, sampler_radiance_mipmap, uv);
  return main + radiance;
}
```

Use um sampler linear para o mipmap:

```rust
let sampler_rc_mipmap = device.create_sampler(&SamplerDescriptor {
    label: Some("rc_mipmap_sampler"),
    mag_filter: FilterMode::Linear,
    min_filter: FilterMode::Linear,
    mipmap_filter: MipmapFilterMode::Nearest,
    ..Default::default()
});
```

## Otimização adicional {#further-optimization}

[Radiance Cascades: A Novel High-Resolution Formal Solution for Multidimensional Non-LTE Radiative Transfer]

| RC clássico (2024 e anteriores)                                      | RC holográfico (HRC)                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Sondas discretas**: médias dos raios armazenadas em pontos da grade | **Fronteiras holográficas**: iluminação direcional armazenada nas fronteiras     |
| **Interpolação bilinear**: suaviza as bordas de sombras duras        | **Reconstrução por integral de fronteira**: preserva descontinuidades            |
| **Apenas sombras suaves**: adequado para luz indireta/ambiente       | **Sombras duras e suaves**: preserva as bordas nítidas de sombras de luz pontual |

## Leitura adicional {#extended-reading}

-   [RadianceCascadesPaper]
-   [Radiance Cascades: A Novel High-Resolution Formal Solution for
    Multidimensional Non-LTE Radiative Transfer]
-   [Fundamentals of Radiance Cascades]
-   [Building Real-Time Global Illumination]
-   [Radiance Cascades]
-   [POC / Radiance Cascades]
-   [akari]
-   [bevy_radiance_cascades]
-   [compute toys]
-   [Guest: Radiance Cascades]

[RadianceCascadesPaper]: https://github.com/Raikiri/RadianceCascadesPaper/blob/main/out_latexmk2/RadianceCascades.pdf
[Radiance Cascades: A Novel High-Resolution Formal Solution for Multidimensional Non-LTE Radiative Transfer]: https://arxiv.org/pdf/2408.14425
[Fundamentals of Radiance Cascades]: https://m4xc.dev/articles/fundamental-rc/
[Building Real-Time Global Illumination]: https://jason.today/gi
[Radiance Cascades]: https://jason.today/rc
[akari]: https://akari.lusion.co/#home
[compute toys]: https://compute.toys/view/1397
[POC / Radiance Cascades]: https://tmpvar.com/poc/radiance-cascades/
[bevy_radiance_cascades]: https://github.com/nixonyh/bevy_radiance_cascades
[Guest: Radiance Cascades]: https://mini.gmshaders.com/p/radiance-cascades
[Lição 2 - Desenhar um círculo]: /pt-BR/guide/lesson-002#sdf
[Lição 9 - Desenhar elipse e retângulo]: /pt-BR/guide/lesson-009#stretch-approximately-method
[Lição 35 - Renderização baseada em tiles]: /pt-BR/guide/lesson-035
[distfunctions2d]: https://iquilezles.org/articles/distfunctions2d/
[vello]: https://github.com/linebender/vello
