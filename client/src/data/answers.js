// 케이스 정답 — 채점 시에만 동적 import (별도 청크). 정적 사이트 특성상 완전 비공개는 불가(번들에 포함됨).
// text는 choices.js 정답 선택지 text와 정확히 같아야 한다. keywords는 원본 보존용(현재 채점은 4지선다 text 비교).
export default {
  s1e01: {
      suspect: { text: '루카 모레노 (조카)',           keywords: ['루카', '조카', 'luca', 'moreno'] },
      weapon:  { text: '와인에 탄 청산가리 (시안화칼륨)', keywords: ['청산가리', '시안화', '와인', '독', 'kcn'] },
      motive:  { text: '단독 유산 상속',               keywords: ['유산', '상속', '재산', '유언장'] },
  },
  s1e02: {
      suspect: { text: '마르코 페라리 (장남)',          keywords: ['마르코', '장남', 'marco', 'ferrari'] },
      weapon:  { text: '와파린(항응고제)을 와인에 혼합', keywords: ['와파린', '항응고제', '와인', 'warfarin', '혈액희석'] },
      motive:  { text: '아버지 재혼 시 상속 지분 감소 방지', keywords: ['상속', '재혼', '유산', '부채', '재산'] },
  },
  s1e03: {
      suspect: { text: '카밀로 루소 (부두목)',           keywords: ['카밀로', '부두목', 'camillo', 'russo'] },
      weapon:  { text: '술에 수면제(졸피뎀) 혼합 후 익사', keywords: ['수면제', '졸피뎀', '익사', '물', 'zolpidem'] },
      motive:  { text: '조직 내 숙청 위기 + 자산 관리권', keywords: ['숙청', '조직', '자산', '채무', '제거'] },
  },
  s1e04: {
      suspect: { text: '다리오 팔코 (후원자·미술 거래상)',    keywords: ['다리오', '팔코', '후원자', 'dario', 'falco'] },
      weapon:  { text: '둔기 (조각상 받침대 추정)',           keywords: ['둔기', '받침대', '조각상', '둔탁한', 'blunt'] },
      motive:  { text: '불법 경매 판매 + 안나의 비리 제보 차단', keywords: ['제보', '밀수', '경매', '비리', '차단'] },
  },
  s1e05: {
      suspect: { text: '미켈레 로시 (팀 매니저)',         keywords: ['미켈레', '매니저', 'michele', 'rossi'] },
      weapon:  { text: '에너지 드링크에 GHB(물뽕) 혼합',  keywords: ['ghb', '물뽕', '에너지드링크', '음료', '수면제'] },
      motive:  { text: '이적 차단 + 횡령 은폐',           keywords: ['이적', '횡령', '감사', '계약', '은폐'] },
  },
  s1e06: {
      suspect: { text: '도나토 세라피니 (재심 청구 변호사)',    keywords: ['도나토', '세라피니', '변호사', 'donato', 'serafini'] },
      weapon:  { text: '난간 볼트 사전 제거 후 계단에서 밀어 떨어뜨림', keywords: ['난간', '볼트', '계단', '밀었다', '추락'] },
      motive:  { text: '재심 기각 결정 저지 (브루노 무죄 청구 차단)',    keywords: ['재심', '기각', '브루노', '무죄', '판결'] },
  },
  s1e07: {
      suspect: { text: '루카 만치니 (아들)',             keywords: ['루카', '아들', 'luca', 'mancini'] },
      weapon:  { text: '물감에 납 화합물(초산납) 장기 혼합', keywords: ['납', '물감', '초산납', 'lead', '안료'] },
      motive:  { text: '위작 판매 수익 독점 + 들키기 전 제거', keywords: ['위작', '유산', '수익', '들키다', '감추다'] },
  },
  sp01: {
      suspect: { text: '나탈리 웨스트 (공동투자자)',            keywords: ['나탈리', '웨스트', 'natalie', 'west', '투자자'] },
      weapon:  { text: '칵테일에 미다조람(수면제) 혼합 후 방치', keywords: ['미다조람', '수면제', '칵테일', '방치', 'midazolam'] },
      motive:  { text: '공동 투자 지분 단독 전환',              keywords: ['지분', '투자', '단독', '이익', '소송'] },
  },
  sp02: {
      suspect: { text: '미켈레 파가노 (사업 파트너)',           keywords: ['미켈레', '파가노', '파트너', 'michele', 'pagano'] },
      weapon:  { text: '난간 볼트 사전 제거 + 음료 알코올 강화로 만취 유도 후 추락', keywords: ['난간', '볼트', '만취', '추락', '음료'] },
      motive:  { text: '펀드 횡령 은폐 + 내부 감사 차단',       keywords: ['횡령', '감사', '펀드', '은폐', '파산'] },
  },
  sp03: {
      suspect: { text: '지나 로마노 (신부 어머니)',              keywords: ['지나', '로마노', '신부어머니', 'gina', 'romano'] },
      weapon:  { text: '케이크에 땅콩 오일 주입 + 에피펜 숨김', keywords: ['땅콩', '케이크', '에피펜', '알레르기', '오일'] },
      motive:  { text: '20년 전 사업 배신에 대한 복수',          keywords: ['복수', '배신', '원한', '파산', '20년'] },
  },
};
