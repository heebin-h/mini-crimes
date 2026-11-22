import subprocess, shutil, sys
R='/private/tmp/claude-501/-Users-heebiny-diyProj/de3d685c-b1e1-4e28-bdde-43748468e30c/scratchpad/mut'
H=R+'/src/net/hostRoom.js'; G=R+'/src/game/grading.js'
orig={H:open(H,encoding='utf-8').read(), G:open(G,encoding='utf-8').read()}
M=[
 ('M1 참가 토큰 검사 제거',H,"p.name === name && p.token === token","p.name === name"),
 ('M2 정원 검사 off-by-one',H,"room.players.length >= LIMITS.maxPlayers","room.players.length > LIMITS.maxPlayers"),
 ('M3 채점 반전',G,"correct: given === text","correct: given !== text"),
 ('M4 제출 phase 검사 제거',H,"if (room?.phase !== 'playing') return reply({ ok: false, error: 'NOT_PLAYING' });",""),
 ('M5 전원 제출 every→some',H,"active.every(p => room.playerAnswers[p.id])","active.some(p => room.playerAnswers[p.id])"),
 ('M6 단서 id 검증 제거',H,"if (!c?.clueCards.some(cc => cc.id === clueId)) return;",""),
 ('M7 메모 길이 제한 제거',H,".slice(0, LIMITS.noteLen)",""),
 ('M8 room:state에 token 노출',H,"players: players.map(({ id, name, connected }) => ({ id, name, connected })),","players: players.map(({ id, name, connected, token }) => ({ id, name, connected, token })),"),
 ('M9 유예 중 플레이어 제외',H,"p.connected || (p.graceUntil ?? 0) > t","p.connected"),
 ('M10 게스트도 수동 공개',H,"if (room?.hostId === from && room.phase === 'playing') reveal();","if (room.phase === 'playing') reveal();"),
 ('M11 이름 중복 허용',H,"if (room.players.some(p => p.name === name)) return ack?.({ ok: false, error: 'NAME_TAKEN' });",""),
 ('M12 단서 중복 공개 허용',H,"if (!room.revealedClues.includes(clueId)) {","if (true) {"),
 ('M13 로비 이탈 자리 미반환',H,"if (room.phase === 'lobby' && room.hostId !== peerId) {","if (false) {"),
 ('M14 방 덮어쓰기 허용',H,"if (room) return ack?.({ ok: false, error: 'ROOM_EXISTS' });",""),
 ('M15 답안 길이 제한 제거',H,"str(src[q], LIMITS.answerLen)","str(src[q], 99999)"),
 ('M16 재접속 답안 승계 제거',H,"if (room.playerAnswers[oldId]) { room.playerAnswers[from] = room.playerAnswers[oldId]; delete room.playerAnswers[oldId]; }",""),
 ('M17 공개 중복 방지 제거',H,"if (!room || room.phase !== 'playing' || revealing) return;","if (!room) return;"),
 ('M18 pointer 좌표 clamp 제거',H,"Math.min(1, Math.max(0, v))","v"),
]
caught=0
for name,f,a,b in M:
    src=orig[f]
    if src.count(a)!=1: print('SKIP(패턴 불일치)',name, src.count(a)); continue
    open(f,'w',encoding='utf-8').write(src.replace(a,b))
    r=subprocess.run(['node','--test','test/exhaustive.test.js','test/hostRoom.test.js','test/data-grading-profile.test.js'],cwd=R,capture_output=True,text=True)
    killed = r.returncode!=0
    ex=subprocess.run(['node','--test','test/exhaustive.test.js'],cwd=R,capture_output=True,text=True).returncode!=0
    print(('KILLED ' if killed else 'SURVIVED'), '| 신규(exhaustive)만으로:', 'KILLED' if ex else 'SURVIVED', '|', name)
    caught+=killed
    open(f,'w',encoding='utf-8').write(orig[f])
print('전체 테스트가 잡은 변이:', caught, '/', len(M))
