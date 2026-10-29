---
title: 照明參考
outline: deep
---

# 照明參考

返回[第 39 課](/zh-Hant/guide/lesson-039#lighting)體驗互動場景。

## 概覽與相容性

在靜止的立方體、球體與圓柱上比較環境光、方向光、點光源與聚光燈。切換光源，調整強度／範圍以及球體的金屬度／粗糙度，啟用攝影棚環境照明並投射陰影，或播放聚光燈軌道。點光源與聚光燈可以使用原來的平滑範圍衰減，或改用可設定參考距離的平方反比衰減。渲染器使用 GGX 直接照明，輸入從 sRGB 轉到線性，並做電影式色調對應。LDR 全景或 Radiance HDR 影像提供球諧漫射照明，以及搭配 split-sum BRDF 查找的預過濾反射。

## 參數與限制

完整參數、預設值與限制請參閱[英文詳細參考](/guide/lighting-reference#parameters-and-limits)。

最多兩盞 `castShadow: true` 的方向光、點光源或聚光燈可以同時投射陰影，並以 3 × 3 PCF 過濾。每盞燈可以設定 `shadowStrength`（0–1）、`shadowSoftness`（0–4 個紋素）、`shadowBiasScale`（0–4），以及 `shadowNormalBias`（0–10 個畫布單位）；預設值保留原來的外觀。每個 Mesh 可以透過 `material3d.castShadow` 與 `material3d.receiveShadow` 各自選擇不投射或不接收（兩者預設都是 `true`）。方向光貼圖貼合目前的 Mesh；半角低於 85° 的聚光錐使用一張透視貼圖，較寬的光錐與點光源使用六面圖集。圖集面接縫上的 PCF 取樣會改採相鄰面，而不是重複邊界紋素。控制項、貼圖尺寸與 API 細節見 [照明範例](/example/lighting)。

自發光表面用 `material3d.emissiveFactor` 與 `emissiveStrength` 控制發光，而不必加一盞場景光。glTF 的 `KHR_materials_emissive_strength` 會隨材質匯入與匯出；可在 [照明範例](/example/lighting) 裡試立方體的發光滑桿。

若要不受照明影響的平面顏色，`material3d.unlit` 會略過場景光與色調對應，同時保留基礎色紋理與 alpha。glTF 的 `KHR_materials_unlit` 在匯入與 GLB 匯出時會保留；在 [照明範例](/example/lighting) 裡用立方體開關，把它和自發光比較。

有紋理的鏤空與半透明表面，`material3d.alphaMode` 提供 `mask` 與 `blend`；它們的陰影行為與排序限制見 [3D Mesh 透明度範例](/example/mesh3d-alpha)。

WebGL1 片段著色器讀取 uniform 陣列時需要常數索引。渲染器會在 WebGL1 上為光源資料與陰影矩陣產生有界的查找；WebGL2 與 WebGPU 保留原生索引。材質著色把顏色傳回 `main()`，因此 WebGL1 的輸出轉換對無光照材質也會執行。瀏覽器回歸會強制使用 WebGL1，並檢查頂點顏色、切線空間法線貼圖、多個光源，以及方向光／點光源陰影。
