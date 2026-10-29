---
title: Referencia de iluminación
outline: deep
---

# Referencia de iluminación

Prueba la escena interactiva en la [lección 39](/es/guide/lesson-039#lighting).

## Resumen y compatibilidad

Compara luces ambientales, direccionales, puntuales y de foco sobre un cubo, una esfera y un cilindro quietos. Cambia de luz, ajusta la intensidad y el alcance y los valores de metallic y roughness de la esfera, activa la iluminación de entorno de estudio y proyecta sombras, o reproduce la órbita del foco. Las luces puntuales y de foco pueden usar la atenuación suave original por alcance, o bien optar por la atenuación de inverso del cuadrado con una distancia de referencia configurable. El renderizador usa iluminación directa GGX, con entradas de sRGB a lineal y mapeo de tonos fílmico. Un panorama LDR o una imagen Radiance HDR aporta iluminación difusa por armónicos esféricos y reflejos prefiltrados, con una consulta BRDF de split-sum.

## Parámetros y límites

Consulta la [referencia detallada en inglés](/guide/lighting-reference#parameters-and-limits) para todos los parámetros, valores predeterminados y límites.

Hasta dos luces direccionales, puntuales o de foco con `castShadow: true` proyectan sombras a la vez, filtradas con PCF de 3 × 3. Cada luz puede fijar `shadowStrength` (0–1), `shadowSoftness` (0–4 téxeles), `shadowBiasScale` (0–4) y `shadowNormalBias` (0–10 unidades del lienzo). Los valores predeterminados conservan el aspecto original. Cada malla puede optar, de forma independiente, por no proyectar o no recibir sombras mediante `material3d.castShadow` y `material3d.receiveShadow` (ambos valen `true` de forma predeterminada). Los mapas direccionales se ajustan a las mallas actuales. Los conos de foco por debajo de 85° de semiángulo usan un mapa en perspectiva, mientras que los conos más abiertos y las luces puntuales usan seis caras de atlas. Los muestreos PCF en las costuras de las caras del atlas muestrean la cara vecina, en lugar de repetir el téxel del borde. Consulta el [ejemplo de iluminación](/example/lighting) para los controles, los tamaños de mapa y los detalles de la API.

Para las superficies autoiluminadas, `material3d.emissiveFactor` y `emissiveStrength` controlan la emisión sin añadir una luz de escena. glTF `KHR_materials_emissive_strength` se importa y se exporta con el material. Prueba el deslizador de emisión del cubo en el [ejemplo de iluminación](/example/lighting).

Para colores planos independientes de la iluminación, `material3d.unlit` evita las luces de escena y el mapeo de tonos, y conserva la textura de color base y el alfa. glTF `KHR_materials_unlit` se conserva en la importación y en la exportación GLB. Compáralo con la emisión mediante el interruptor del cubo en el [ejemplo de iluminación](/example/lighting).

Para recortes con textura y superficies translúcidas, `material3d.alphaMode` ofrece `mask` y `blend`. Consulta el [ejemplo de transparencia de mallas 3D](/example/mesh3d-alpha) para su comportamiento de sombras y sus límites de orden.

Los shaders de fragmentos de WebGL1 exigen índices constantes al leer arrays de uniforms. El renderizador genera búsquedas acotadas para los datos de luz y las matrices de sombra en WebGL1. WebGL2 y WebGPU conservan la indexación nativa. El sombreado del material devuelve su color a `main()`, para que la conversión de salida de WebGL1 también se ejecute en los materiales unlit. Las regresiones del navegador fuerzan WebGL1 y comprueban los colores de vértice, los mapas de normales en espacio tangente, varias luces y las sombras direccionales y puntuales.
