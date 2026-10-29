---
title: 조명 참고 자료
outline: deep
---

# 조명 참고 자료

[39강](/ko/guide/lesson-039#lighting)에서 데모를 체험할 수 있습니다.

## 개요와 호환성

멈춰 있는 정육면체, 구, 원기둥에서 앰비언트, 디렉셔널, 포인트, 스포트 조명을 비교합니다. 조명을 바꾸고, 세기/범위와 구의 메탈릭/러프니스를 조절하고, 스튜디오 환경 조명과 그림자 드리우기를 켜거나, 스포트라이트 궤도를 재생합니다. 포인트와 스포트 조명은 원래의 부드러운 범위 감쇠를 쓰거나, 설정 가능한 기준 거리와 함께 역제곱 감쇠를 선택할 수 있습니다. 렌더러는 sRGB에서 선형으로 변환한 입력과 필름릭 톤 매핑으로 GGX 직접 조명을 사용합니다. LDR 파노라마 또는 Radiance HDR 이미지가 구면 조화 난반사 조명과, split-sum BRDF 룩업이 있는 프리필터된 반사를 제공합니다.

## 매개변수와 제한

모든 매개변수, 기본값과 제한은 [영문 상세 참고 자료](/guide/lighting-reference#parameters-and-limits)를 참고하세요.

`castShadow: true`인 디렉셔널, 포인트, 스포트 조명은 한 번에 최대 두 개까지 그림자를 드리우며, 3 × 3 PCF로 필터링됩니다. 각 조명은 `shadowStrength`(0–1), `shadowSoftness`(0–4 텍셀), `shadowBiasScale`(0–4), `shadowNormalBias`(0–10 캔버스 단위)를 설정할 수 있습니다. 기본값은 원래 모습을 유지합니다. 각 메시는 `material3d.castShadow`와 `material3d.receiveShadow`로 그림자 드리우기와 받기를 따로 끌 수 있습니다(둘 다 기본값은 `true`). 디렉셔널 맵은 현재 메시에 맞춰집니다. 반각 85° 미만의 스포트 원뿔은 원근 맵 하나를 쓰고, 더 넓은 원뿔과 포인트 조명은 아틀라스 면 여섯 개를 사용합니다. 아틀라스 면 경계의 PCF 샘플은 가장자리 텍셀을 반복하지 않고 이웃 면을 샘플링합니다. 컨트롤, 맵 크기, API 세부 사항은 [조명 예시](/example/lighting)를 참고하세요.

스스로 빛나는 표면은 `material3d.emissiveFactor`와 `emissiveStrength`로, 씬 조명을 더하지 않고 발광을 조절합니다. glTF `KHR_materials_emissive_strength`는 재질과 함께 가져오고 내보냅니다. [조명 예시](/example/lighting)의 정육면체 발광 슬라이더를 사용해 보세요.

조명과 무관한 단색에는 `material3d.unlit`이 씬 조명과 톤 매핑을 건너뛰면서 베이스 컬러 텍스처와 알파는 유지합니다. glTF `KHR_materials_unlit`은 가져오기와 GLB 내보내기에서 보존됩니다. [조명 예시](/example/lighting)의 정육면체 토글로 발광과 비교해 보세요.

텍스처 컷아웃과 반투명 표면에는 `material3d.alphaMode`의 `mask`와 `blend`가 있습니다. 그림자 동작과 정렬 한계는 [3D 메시 투명도 예시](/example/mesh3d-alpha)를 참고하세요.

WebGL1 프래그먼트 셰이더는 유니폼 배열을 읽을 때 상수 인덱스가 필요합니다. 렌더러는 WebGL1에서 조명 데이터와 그림자 행렬에 대해 범위가 제한된 조회를 생성합니다. WebGL2와 WebGPU는 네이티브 인덱싱을 유지합니다. 재질 셰이딩은 색을 `main()`으로 돌려주므로, unlit 재질에서도 WebGL1 출력 변환이 실행됩니다. 브라우저 회귀 테스트는 WebGL1을 강제하고, 정점 색, 접선 공간 노멀 맵, 다중 조명, 디렉셔널/포인트 그림자를 검사합니다.
