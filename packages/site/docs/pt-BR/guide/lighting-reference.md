---
title: Referência de iluminação
outline: deep
---

# Referência de iluminação

Experimente a cena interativa na [lição 39](/pt-BR/guide/lesson-039#lighting).

## Visão geral e compatibilidade

Compare luzes ambiente, direcionais, pontuais e spot em um cubo, uma esfera e um cilindro parados. Troque as luzes, ajuste intensidade/alcance e os valores metallic/roughness da esfera, ative a iluminação de ambiente de estúdio e projete sombras, ou reproduza a órbita do spotlight. Luzes pontuais e spot podem usar o decaimento suave original do alcance ou optar pelo decaimento do inverso do quadrado com uma distância de referência configurável. O renderizador usa iluminação direta GGX com entradas de sRGB para linear e tone mapping fílmico. Um panorama LDR ou uma imagem Radiance HDR fornece iluminação difusa por harmônicos esféricos e reflexões pré-filtradas com uma consulta BRDF de soma dividida.

## Parâmetros e limites

Consulte a [referência detalhada em inglês](/guide/lighting-reference#parameters-and-limits) para todos os parâmetros, padrões e limites.

Até duas luzes direcionais, pontuais ou spot com `castShadow: true` projetam sombras ao mesmo tempo, filtradas com PCF 3 × 3. Cada luz pode definir `shadowStrength` (0–1), `shadowSoftness` (0–4 texels), `shadowBiasScale` (0–4) e `shadowNormalBias` (0–10 unidades da tela); os padrões preservam a aparência original. Cada mesh pode optar, de forma independente, por não projetar ou não receber por meio de `material3d.castShadow` e `material3d.receiveShadow` (ambos têm padrão `true`). Os mapas direcionais se ajustam às meshes atuais; cones spot abaixo de 85° de meio-ângulo usam um mapa em perspectiva, enquanto cones mais abertos e luzes pontuais usam seis faces de atlas. As amostras PCF nas emendas das faces do atlas amostram a face vizinha em vez de repetir o texel da borda. Veja o [exemplo de iluminação](/example/lighting) para os controles, os tamanhos dos mapas e os detalhes da API.

Para superfícies que se iluminam sozinhas, `material3d.emissiveFactor` e `emissiveStrength` controlam a emissão sem adicionar uma luz de cena. O glTF `KHR_materials_emissive_strength` é importado e exportado com o material; experimente o controle deslizante de emissão do cubo no [exemplo de iluminação](/example/lighting).

Para cores chapadas independentes da iluminação, `material3d.unlit` ignora as luzes da cena e o tone mapping, conservando a textura de cor base e o alfa. O glTF `KHR_materials_unlit` é preservado na importação e na exportação GLB; compare-o com a emissão usando o interruptor do cubo no [exemplo de iluminação](/example/lighting).

Para recortes texturizados e superfícies translúcidas, `material3d.alphaMode` oferece `mask` e `blend`; veja o [exemplo de transparência de mesh 3D](/example/mesh3d-alpha) para o comportamento das sombras e os limites de ordenação.

Shaders de fragmento de WebGL1 exigem índices constantes ao ler arrays de uniform.
O renderizador gera consultas limitadas para dados de luz e matrizes de sombra no
WebGL1; WebGL2 e WebGPU conservam a indexação nativa. O sombreamento do material devolve a
cor para `main()`, para que a conversão de saída do WebGL1 também rode em materiais unlit.
Regressões do navegador forçam WebGL1 e conferem cores de vértice, mapas de normal em espaço tangente,
várias luzes e sombras direcionais/pontuais.
