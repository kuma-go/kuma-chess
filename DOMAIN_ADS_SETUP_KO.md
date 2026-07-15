# kumachess.com 연결 및 AdSense 설정

## 1. GitHub Pages DNS

도메인 구입처의 DNS 관리 화면에서 루트 도메인(`@`)에 아래 A 레코드 4개를 각각 추가합니다.

| 유형 | 호스트 | 값 |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

`www.kumachess.com`도 사용하려면 다음 레코드를 추가합니다.

| 유형 | 호스트 | 값 |
| --- | --- | --- |
| CNAME | www | kuma-go.github.io |

- 기존 `@` A/AAAA 레코드나 URL 포워딩이 다른 서버를 가리키면 제거합니다.
- `*` 와일드카드 DNS 레코드는 만들지 않습니다.
- 저장소 루트의 `CNAME`은 `kumachess.com`으로 설정되어 있습니다.
- DNS 전파 후 GitHub Pages 설정에서 `Check again`을 누릅니다.
- DNS 검사가 통과하고 인증서가 발급되면 `Enforce HTTPS`를 켭니다.

## 2. AdSense 사이트 소유권

- 게시자 ID: `ca-pub-7173992156420612`
- 사이트의 주요 HTML 문서에 AdSense 소유권 확인 스크립트가 포함되어 있습니다.
- 루트의 `ads.txt`에도 동일한 게시자 ID가 등록되어 있습니다.
- 배포 후 AdSense에서 `코드를 삽입했습니다`를 체크하고 검토를 요청합니다.

## 3. 실제 광고 활성화

현재 `ads-config.js`는 소유권 검토만 가능하도록 광고 슬롯을 비활성화한 상태입니다. AdSense에서 상단 디스플레이 광고 단위를 만든 뒤 발급된 숫자 슬롯 ID를 아래처럼 입력합니다.

```js
window.KUMA_ADS_CONFIG = Object.freeze({
  enabled: true,
  client: "ca-pub-7173992156420612",
  topSlot: "발급받은_숫자_슬롯_ID",
  testMode: false,
});
```

유효한 슬롯 ID가 없으면 게임은 광고 요청과 상단 빈 공간을 모두 만들지 않습니다.
