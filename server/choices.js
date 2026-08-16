// 객관식 선택지 — correct 항목 text는 db.js answer.text와 정확히 동일해야 함
// correct: true 는 서버 전용 (클라이언트 전달 시 제거)

module.exports = {
  s1e01: {
    suspect: [
      { id: 'a', text: '루카 모레노 (조카)', correct: true },
      { id: 'b', text: '마르코 베르디 (정원사)' },
      { id: 'c', text: '알베르토의 사업 파트너' },
      { id: 'd', text: '와인 납품 업체 직원' },
    ],
    weapon: [
      { id: 'a', text: '와인에 탄 청산가리 (시안화칼륨)', correct: true },
      { id: 'b', text: '음식에 비소 혼합' },
      { id: 'c', text: '수면제 과다 투약 후 질식' },
      { id: 'd', text: '아몬드 과자에 독 주입' },
    ],
    motive: [
      { id: 'a', text: '단독 유산 상속', correct: true },
      { id: 'b', text: '오래된 사업 분쟁 복수' },
      { id: 'c', text: '생명보험 수령' },
      { id: 'd', text: '실수로 인한 과실치사' },
    ],
  },

  s1e02: {
    suspect: [
      { id: 'a', text: '마르코 페라리 (장남)', correct: true },
      { id: 'b', text: '소피아 페라리 (막내딸)' },
      { id: 'c', text: '레나 비앙키 (마르코 아내)' },
      { id: 'd', text: '가족 주치의 닥터 로시' },
    ],
    weapon: [
      { id: 'a', text: '와파린(항응고제)을 와인에 혼합', correct: true },
      { id: 'b', text: '식사에 독버섯 추출물 첨가' },
      { id: 'c', text: '약 처방전 위조 후 과다복용 유도' },
      { id: 'd', text: '쐐기풀 독소 피부 노출' },
    ],
    motive: [
      { id: 'a', text: '아버지 재혼 시 상속 지분 감소 방지', correct: true },
      { id: 'b', text: '과거 아동 학대에 대한 복수' },
      { id: 'c', text: '사업 실패 부채 탕감을 위한 보험금' },
      { id: 'd', text: '가족 비밀 영구 은폐' },
    ],
  },

  s1e03: {
    suspect: [
      { id: 'a', text: '카밀로 루소 (부두목)', correct: true },
      { id: 'b', text: '만치니 (회계사)' },
      { id: 'c', text: '레나타 도나티 (내연녀)' },
      { id: 'd', text: '항구 직원 파울로' },
    ],
    weapon: [
      { id: 'a', text: '술에 수면제(졸피뎀) 혼합 후 익사', correct: true },
      { id: 'b', text: '구명조끼 에어백 밸브 사전 절단 후 익사 유도' },
      { id: 'c', text: '음료에 근이완제 투입 후 수중 방치' },
      { id: 'd', text: '갑판 난간 볼트 제거 후 실족사 위장' },
    ],
    motive: [
      { id: 'a', text: '조직 내 숙청 위기 + 자산 관리권', correct: true },
      { id: 'b', text: '밀수 루트 독점을 위한 경쟁자 제거' },
      { id: 'c', text: '과거 배신 행위에 대한 복수' },
      { id: 'd', text: '선박 보험금 단독 수령' },
    ],
  },

  s1e04: {
    suspect: [
      { id: 'a', text: '다리오 팔코 (후원자·미술 거래상)', correct: true },
      { id: 'b', text: '박물관 경비원 지오르지오' },
      { id: 'c', text: '복원사 지아코모 펠리니' },
      { id: 'd', text: '전시 기획자 엘레나 마르티니' },
    ],
    weapon: [
      { id: 'a', text: '둔기 (조각상 받침대 추정)', correct: true },
      { id: 'b', text: '수면제 혼입 후 쓰러뜨려 낙상 위장' },
      { id: 'c', text: '비상구 함정 설치로 낙하 유도' },
      { id: 'd', text: '야간 수장고 전기 합선 유발' },
    ],
    motive: [
      { id: 'a', text: '불법 경매 판매 + 안나의 비리 제보 차단', correct: true },
      { id: 'b', text: '위작 판매 공모 증거 인멸' },
      { id: 'c', text: '도박 부채 청산을 위한 급전 마련' },
      { id: 'd', text: '관장직 쟁취를 위한 경쟁자 제거' },
    ],
  },

  s1e05: {
    suspect: [
      { id: 'a', text: '미켈레 로시 (팀 매니저)', correct: true },
      { id: 'b', text: '크리스티안 가티 (라이벌 선수)' },
      { id: 'c', text: '스폰서 측 대리인 카를로스' },
      { id: 'd', text: '게임단 영양사 유이' },
    ],
    weapon: [
      { id: 'a', text: '에너지 드링크에 GHB(물뽕) 혼합', correct: true },
      { id: 'b', text: '헤드셋에 초저주파 발생 장치 부착' },
      { id: 'c', text: '경기 전날 수면제 음식에 투입' },
      { id: 'd', text: '키보드에 접촉성 신경독 도포' },
    ],
    motive: [
      { id: 'a', text: '이적 차단 + 횡령 은폐', correct: true },
      { id: 'b', text: '스폰서 계약 독점을 위한 라이벌 제거' },
      { id: 'c', text: '결승 진출 자리 확보' },
      { id: 'd', text: '과거 사기 행각 폭로 무마' },
    ],
  },

  s1e06: {
    suspect: [
      { id: 'a', text: '도나토 세라피니 (재심 청구 변호사)', correct: true },
      { id: 'b', text: '나탈리아 칼라브레제 (친딸)' },
      { id: 'c', text: '가정부 카르멘' },
      { id: 'd', text: '저택 리모델링 업체 직원' },
    ],
    weapon: [
      { id: 'a', text: '난간 볼트 사전 제거 후 계단에서 밀어 떨어뜨림', correct: true },
      { id: 'b', text: '수면제 혼입 후 계단 위에서 밀침' },
      { id: 'c', text: '조명 타이머 조작으로 암실 낙상 유발' },
      { id: 'd', text: '지팡이 내부 구조 약화로 균형 상실 유도' },
    ],
    motive: [
      { id: 'a', text: '재심 기각 결정 저지 (브루노 무죄 청구 차단)', correct: true },
      { id: 'b', text: '유산 독점 목적' },
      { id: 'c', text: '저택 매각 결정에 대한 분노' },
      { id: 'd', text: '과거 판결 불복 복수' },
    ],
  },

  s1e07: {
    suspect: [
      { id: 'a', text: '루카 만치니 (아들)', correct: true },
      { id: 'b', text: '비토리아 첼리 (수제자)' },
      { id: 'c', text: '갤러리 딜러 파비오' },
      { id: 'd', text: '경쟁 화가 조반니 마리니' },
    ],
    weapon: [
      { id: 'a', text: '물감에 납 화합물(초산납) 장기 혼합', correct: true },
      { id: 'b', text: '아틀리에 환기구 봉쇄로 시너 흡입 유도' },
      { id: 'c', text: '물통에 비소 소량씩 투입' },
      { id: 'd', text: '수면제를 커피에 장기 첨가' },
    ],
    motive: [
      { id: 'a', text: '위작 판매 수익 독점 + 들키기 전 제거', correct: true },
      { id: 'b', text: '작품 저작권 단독 취득 후 재판매' },
      { id: 'c', text: '아버지의 유산 빠른 수령' },
      { id: 'd', text: '위작 폭로 차단' },
    ],
  },

  sp01: {
    suspect: [
      { id: 'a', text: '나탈리 웨스트 (공동투자자)', correct: true },
      { id: 'b', text: '커티스 레인 (소송 상대방)' },
      { id: 'c', text: '에밀리 크레인 (전처)' },
      { id: 'd', text: '파티 케이터링 직원' },
    ],
    weapon: [
      { id: 'a', text: '칵테일에 미다조람(수면제) 혼합 후 방치', correct: true },
      { id: 'b', text: '협박 편지 심리적 압박 후 계단에서 밀침' },
      { id: 'c', text: '음식에 알레르기 유발 물질 은밀 혼입' },
      { id: 'd', text: '가면 파티 혼잡을 틈탄 독침' },
    ],
    motive: [
      { id: 'a', text: '공동 투자 지분 단독 전환', correct: true },
      { id: 'b', text: '소송 무마를 위한 증거 인멸' },
      { id: 'c', text: '불륜 관계 폭로 협박 차단' },
      { id: 'd', text: '양육비 분쟁 완전 종결' },
    ],
  },

  sp02: {
    suspect: [
      { id: 'a', text: '미켈레 파가노 (사업 파트너)', correct: true },
      { id: 'b', text: '프란체스카 리치 (아내)' },
      { id: 'c', text: '다비데 베르토 (전 직원)' },
      { id: 'd', text: '파티 주최 건물 관리인' },
    ],
    weapon: [
      { id: 'a', text: '난간 볼트 사전 제거 + 음료 알코올 강화로 만취 유도 후 추락', correct: true },
      { id: 'b', text: '옥상에서 직접 밀친 후 실족사 위장' },
      { id: 'c', text: '음료에 환각제 투입 후 추락 유도' },
      { id: 'd', text: '승강기 오작동 유발 후 추락' },
    ],
    motive: [
      { id: 'a', text: '펀드 횡령 은폐 + 내부 감사 차단', correct: true },
      { id: 'b', text: '이혼 소송 불리한 증거 파기' },
      { id: 'c', text: '해고 복수 및 회사 기밀 탈취' },
      { id: 'd', text: '카지노 부채 협박 관계 청산' },
    ],
  },

  sp03: {
    suspect: [
      { id: 'a', text: '지나 로마노 (신부 어머니)', correct: true },
      { id: 'b', text: '루치아노 바소 (사업 라이벌)' },
      { id: 'c', text: '알베르토 살라 (신랑, 아들)' },
      { id: 'd', text: '웨딩 케이터링 매니저' },
    ],
    weapon: [
      { id: 'a', text: '케이크에 땅콩 오일 주입 + 에피펜 숨김', correct: true },
      { id: 'b', text: '식전 음료에 알레르기 유발 단백질 용해' },
      { id: 'c', text: '에피펜을 가짜 제품으로 교체' },
      { id: 'd', text: '결혼식장 환기 차단으로 아나필락시스 악화 유도' },
    ],
    motive: [
      { id: 'a', text: '20년 전 사업 배신에 대한 복수', correct: true },
      { id: 'b', text: '계약 분쟁 합의금 강제 목적' },
      { id: 'c', text: '결혼 반대를 위한 극단적 방해' },
      { id: 'd', text: '결혼식 보험 사기' },
    ],
  },
};
