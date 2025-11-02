// ----- DATA -----
var teams = [
  { id: 'UMA', name: 'UMA', color: '#f97316', logoUrl: 'uma.png' },
  { id: 'NJL', name: 'NJL', color: '#38bdf8', logoUrl: 'njl.png' },
  { id: 'VAT69', name: 'VAT69', color: '#a855f7', logoUrl: 'vat.png' },
  { id: 'FAKE', name: 'Fake Taxi', color: '#facc15', logoUrl: 'ft.png' }
]
var players = ['Asif','Shovon','Sakib','Omar','Osman','Sunny','Prottoy','Farabi']

var tableState = {}
var matchState = {}
var tableOrder = teams.map(function(t){ return t.id })
var BALLS_PER_OVER = 3

// leaderboards
var runBoard = {}
var wicketBoard = {}

// dom
var teamsBar = document.getElementById('teamsBar')
var playersPool = document.getElementById('playersPool')
var teamAllocations = document.getElementById('teamAllocations')
var fixturesWrap = document.getElementById('fixturesWrap')
var pointsTableBody = document.querySelector('#pointsTable tbody')
var knockoutInfo = document.getElementById('knockoutInfo')
var fixtureNote = document.getElementById('fixtureNote')
var runLeadersEl = document.getElementById('runLeaders')
var wicketLeadersEl = document.getElementById('wicketLeaders')
var knockoutWrap = document.getElementById('knockoutWrap')

var currentAlloc = {}
var currentFinalHost = null


// ----------------------------------------
// helpers
// ----------------------------------------
function teamLogoHTML(team, sizePx) {
  var size = sizePx || 35
  if (team.logoUrl) {
    return (
      '<div class="logo" style="width:'+size+'px;height:'+size+'px;">' +
        '<img src="'+team.logoUrl+'" alt="'+team.name+'" style="width:100%;height:100%;object-fit:cover;" />' +
      '</div>'
    )
  }
  var initials = (team.logoText || team.name.slice(0,2)).toUpperCase()
  return (
    '<div class="logo" style="background:'+team.color+';width:'+size+'px;height:'+size+'px;display:flex;align-items:center;justify-content:center;font-weight:600;">' +
      initials +
    '</div>'
  )
}

function shuffle(arr) {
  return arr
    .map(function(x){ return {v:x, r:Math.random()} })
    .sort(function(a,b){ return a.r - b.r })
    .map(function(o){ return o.v })
}

function renderTeamsBar() {
  teamsBar.innerHTML = ''
  teams.forEach(function(t) {
    var div = document.createElement('div')
    div.className = 'team-pill'
    div.innerHTML = teamLogoHTML(t, 30) + '<span>'+t.name+'</span>'
    teamsBar.appendChild(div)
  })
}

function renderPlayersPool(assignedMap) {
  assignedMap = assignedMap || {}
  playersPool.innerHTML = ''
  players.forEach(function(p){
    var d = document.createElement('div')
    d.textContent = p
    if (assignedMap[p]) d.classList.add('assigned')
    playersPool.appendChild(d)
  })
}

function renderTeamAllocations(alloc) {
  teamAllocations.innerHTML = ''
  teams.forEach(function (t) {
    var cap = alloc[t.id] && alloc[t.id].captain ? alloc[t.id].captain : '---'
    var vice = alloc[t.id] && alloc[t.id].vice ? alloc[t.id].vice : '---'

    var slot = document.createElement('div')
    slot.className = 'team-slot'
    slot.innerHTML =
      '<div style="display:flex;align-items:center;margin-bottom:.35rem;gap:.4rem;">' +
        teamLogoHTML(t, 45) +
        '<strong>'+t.name+'</strong>' +
      '</div>' +
      '<div class="muted">Captain: <strong>'+cap+'</strong></div>' +
      '<div class="muted">Vice-Captain: <strong>'+vice+'</strong></div>'

    teamAllocations.appendChild(slot)
  })
}

function initTableState(order) {
  tableState = {}
  order.forEach(function(id){
    tableState[id] = {
      teamId: id,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      points: 0,
      runsFor: 0,
      runsAgainst: 0,
      oversFaced: 0,
      oversBowled: 0,
      nrr: 0
    }
  })
  updatePointsTable()
}

function fixturePairs() {
  var pairs = []
  for (var i=0;i<teams.length;i++) {
    for (var j=i+1;j<teams.length;j++) {
      pairs.push([teams[i].id, teams[j].id])
    }
  }
  return pairs
}


// ----------------------------------------
// lottery
// ----------------------------------------
function runLottery() {
  // random captains/vice
  var shuffledPlayers = shuffle(players.slice())
  var allocations = {}
  var assignedMap = {}
  var idx = 0
  teams.forEach(function(t){
    var p1 = shuffledPlayers[idx++]
    var p2 = shuffledPlayers[idx++]
    allocations[t.id] = { captain: p1, vice: p2 }
    assignedMap[p1] = true
    assignedMap[p2] = true
  })
  currentAlloc = allocations

  renderTeamAllocations(allocations)
  renderPlayersPool(assignedMap)

  // randomise league order
  tableOrder = shuffle(teams.map(function(t){ return t.id }))
  initTableState(tableOrder)

  // make fixtures
  generateFixtures(allocations)

  // clear knockout ui
  if (knockoutWrap) knockoutWrap.innerHTML = ''
}


// ----------------------------------------
// fixtures
// ----------------------------------------
function createEmptyMatch(teamA, teamB) {
  var m = {
    teams: [teamA, teamB],
    innings: {},
    bowling: {},
	history: [],
    finished: false,
    result: null
  }
  m.innings[teamA] = { runs:0, extras:0, balls:0, overs:0, players:{}, wickets:'' }
  m.innings[teamB] = { runs:0, extras:0, balls:0, overs:0, players:{}, wickets:'' }
  m.bowling[teamA] = { p1:0, p2:0 }
  m.bowling[teamB] = { p1:0, p2:0 }
  return m
}

function generateFixtures(alloc) {
  fixturesWrap.innerHTML = ''
  matchState = {}
  fixtureNote.textContent = ''

  var pairs = fixturePairs()
  pairs.forEach(function(p, index){
    var matchId = 'M' + (index+1)
    matchState[matchId] = createEmptyMatch(p[0], p[1])
    var card = createFixtureCard(matchId, p[0], p[1], alloc)
    fixturesWrap.appendChild(card)
  })
}

function createFixtureCard(matchId, teamAId, teamBId, alloc) {
  var teamA = teams.find(function(t){ return t.id === teamAId })
  var teamB = teams.find(function(t){ return t.id === teamBId })

  var card = document.createElement('div')
  card.className = 'fixture-card'
  card.id = 'card-' + matchId

  var head = document.createElement('div')
  head.className = 'match-title'
  head.innerHTML =
    teamLogoHTML(teamA) +
    '<div><strong>'+teamA.name+'</strong></div>' +
    '<div class="vs">vs</div>' +
    teamLogoHTML(teamB) +
    '<div><strong>'+teamB.name+'</strong></div>' +
    '<span class="muted" style="font-size:.6rem;">'+matchId+'</span>'

  var wrap = document.createElement('div')
  wrap.className = 'inning-wrap'
  wrap.appendChild(createInningsPanel(matchId, teamA, alloc[teamAId], teamB, alloc[teamBId]))
  wrap.appendChild(createInningsPanel(matchId, teamB, alloc[teamBId], teamA, alloc[teamAId]))

  var btm = document.createElement('div')
  btm.style.marginTop = '.4rem'
  btm.style.display = 'flex'
  btm.style.flexDirection = 'column'
  btm.style.alignItems = 'center'
  
btm.innerHTML =
  '<div class="result-line" id="result-' + matchId + '"></div>' +
  '<input class="mom-input" id="mom-' + matchId + '" placeholder="Man of the match" />' +

  // new div wrapper for the action buttons
  '<div class="match-actions" style="display:flex;gap:.5rem;margin-top:.4rem;justify-content: center;">' +

    '<button class="mini-btn" data-role="finish" data-match="' + matchId + '"' +
      ' title="Save match"' +
      'style="color: #22c55e;gap: 2px;font-size: 10px;display: flex;background:rgba(34,197,94,.12);border: 1px solid #22c55e;flex-direction: column;align-items: center;">' +
        '<img src="save.png" alt="Save" style="width:20px;height:20px;vertical-align:middle;">' +
		'Save'+
    '</button>' +

    '<button class="mini-btn" data-role="undo" data-match="' + matchId + '"' +
      ' title="Undo last action"' +
      'style="display: flex;color: #38bdf8;background:rgba(56,189,248,.08);font-size: 10px;border:1px solid rgba(56,189,248,.3);flex-direction: column;align-items: center;gap: 2px">' +
        '<img src="undo.png" alt="Undo" style="width:20px;height:20px;vertical-align:middle;">' +
		'Undo'+
    '</button>' +

    '<button class="mini-btn" data-role="reset" data-match="' + matchId + '"' +
      ' title="Reset match"' +
      'style="display: flex;color: #f43f5e;background:rgba(244,63,94,.1);font-size: 10px;border:1px solid rgba(244,63,94,.3);flex-direction: column;align-items: center;gap: 2px;">' +
        '<img src="reset.png" alt="Reset" style="width:20px;height:20px;vertical-align:middle;">' +
		'Reset'+
    '</button>' +

  '</div>';

  card.appendChild(head)
  card.appendChild(wrap)
  card.appendChild(btm)
  return card
}

function createInningsPanel(matchId, team, allocation, opponentTeam, opponentAlloc) {
  var captain = allocation && allocation.captain ? allocation.captain : 'Player 1'
  var vice = allocation && allocation.vice ? allocation.vice : 'Player 2'

  var oppId = opponentTeam.id
  var oppName = opponentTeam.name
  var oCap = opponentAlloc && opponentAlloc.captain ? opponentAlloc.captain : 'Bowler 1'
  var oVice = opponentAlloc && opponentAlloc.vice ? opponentAlloc.vice : 'Bowler 2'

  var panel = document.createElement('div')
  panel.className = 'score-panel'
panel.innerHTML =
  '<p class="muted" style="margin:0 0 .3rem;font-size:.62rem;display:flex;gap:.35rem;align-items:center;">' +
    teamLogoHTML(team, 28) +
    '<span>'+team.name+' batting</span>' +
  '</p>' +

  // total
  '<div class="score-row">' +
    '<label>Total</label>' +
    '<div class="score-badge" id="total-'+matchId+'-'+team.id+'">0</div>' +
  '</div>' +

  // extras
  '<div class="score-row">' +
    '<label>Extras</label>' +
    '<div class="score-badge" id="extras-'+matchId+'-'+team.id+'">0</div>' +
    '<button class="mini-btn" data-role="add-extra" data-match="'+matchId+'" data-team="'+team.id+'">+1</button>' +
  '</div>' +

  // overs
  '<div class="score-row">' +
    '<label>Over</label>' +
    '<div class="score-badge" id="over-'+matchId+'-'+team.id+'">0.0</div>' +
    '<span class="muted" style="font-size:.55rem;">(3 balls)</span>' +
  '</div>' +

  // batters
  '<div class="players-run" style="margin-top:.35rem;">' +
    '<div>' +
      '<h5 id="p1name-'+matchId+'-'+team.id+'">'+captain+'</h5>' +
      '<div class="muted" id="p1runs-'+matchId+'-'+team.id+'">0 runs</div>' +
      '<div style="display:flex;gap:.25rem;margin-top:.25rem;flex-wrap:wrap;justify-content:space-between;">' +
        runBtnsHTML(matchId, team.id, "p1") +
      '</div>' +
    '</div>' +
    '<div>' +
      '<h5 id="p2name-'+matchId+'-'+team.id+'">'+vice+'</h5>' +
      '<div class="muted" id="p2runs-'+matchId+'-'+team.id+'">0 runs</div>' +
      '<div style="display:flex;gap:.25rem;margin-top:.25rem;flex-wrap:wrap;justify-content:space-between;">' +
        runBtnsHTML(matchId, team.id, "p2") +
      '</div>' +
    '</div>' +
  '</div>' +

  // bowling block
  '<div class="bowling-wrap" style="margin-top:.45rem;">' +
    '<h6 style="margin-bottom:.35rem;">Wickets by '+oppName+'</h6>' +

    '<div class="bowler-line">' +
      '<span>'+oCap+'</span>' +
      '<div>' +
        '<button class="mini-btn" data-role="add-wicket" data-match="'+matchId+'" data-team="'+oppId+'" data-bowler="p1">+1</button> ' +
        '<span class="muted" id="wb-'+matchId+'-'+oppId+'-p1">0</span>' +
      '</div>' +
    '</div>' +

    '<div class="bowler-line">' +
      '<span>'+oVice+'</span>' +
      '<div>' +
        '<button class="mini-btn" data-role="add-wicket" data-match="'+matchId+'" data-team="'+oppId+'" data-bowler="p2">+1</button> ' +
        '<span class="muted" id="wb-'+matchId+'-'+oppId+'-p2">0</span>' +
      '</div>' +
    '</div>' +
  '</div>' +

  // local action bar
// local action bar with image icons
'<div class="bowling-actions" style="display:flex;gap:.45rem;justify-content:space-evenly;margin-top:.4rem;">' +
  '<button class="mini-btn" data-role="finish" data-match="'+matchId+'" title="Save match" ' +
    'style="color: #22c55e;gap: 2px;font-size: 10px;display: flex;background:rgba(34,197,94,.12);border: 1px solid #22c55e;flex-direction: column;align-items: center;">' +
      '<img src="save.png" alt="Save" style="width:20px;height:20px;vertical-align:middle;">' +
	  'Save'+
  '</button>' +

  '<button class="mini-btn" data-role="undo" data-match="'+matchId+'" title="Undo last action" ' +
    'style="display: flex;color: #38bdf8;background:rgba(56,189,248,.08);font-size: 10px;border:1px solid rgba(56,189,248,.3);flex-direction: column;align-items: center;gap: 2px">' +
      '<img src="undo.png" alt="Undo" style="width:20px;height:20px;vertical-align:middle;">' +
	  'Undo'+
  '</button>' +

  '<button class="mini-btn" data-role="reset" data-match="'+matchId+'" title="Reset match" ' +
    'style="display: flex;color: #f43f5e;background:rgba(244,63,94,.1);font-size: 10px;border:1px solid rgba(244,63,94,.3);flex-direction: column;align-items: center;gap: 2px;">' +
      '<img src="reset.png" alt="Reset" style="width:20px;height:20px;vertical-align:middle;">' +
	'Reset'+
  '</button>' +
'</div>';



  return panel
}

function runBtnsHTML(matchId, teamId, playerSlot) {
  var runs = [0,2,4]
  return runs.map(function(r){
    return '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+teamId+'" data-player="'+playerSlot+'" data-runs="'+r+'">'+r+'</button>'
  }).join('')
}


// ----------------------------------------
// score events
// ----------------------------------------
fixturesWrap.addEventListener('click', function(e){
  var role = e.target.dataset.role
  if (!role) return
  var matchId = e.target.dataset.match
  if (!matchId) return

  if (role === 'add-extra') {
    addExtraRun(matchId, e.target.dataset.team)
  } else if (role === 'add-run') {
    addPlayerRun(matchId, e.target.dataset.team, e.target.dataset.player, parseInt(e.target.dataset.runs,10))
  } else if (role === 'finish') {
    finishMatch(matchId)
  } else if (role === 'reset') {
    resetMatch(matchId)
  } else if (role === 'add-wicket') {
    addBowlerWicket(matchId, e.target.dataset.team, e.target.dataset.bowler)
  } else if (role === 'undo') {
    undoLastAction(matchId)
  }
})


function addExtraRun(matchId, teamId) {
  var m = matchState[matchId]
  m.innings[teamId].extras += 1

  // record
  m.history.push({
    type: 'extra',
    teamId: teamId,
    amount: 1
  })

  updateInningsUI(matchId, teamId)
}


function addPlayerRun(matchId, teamId, playerSlot, runs) {
  var m = matchState[matchId]
  var inn = m.innings[teamId]

  if (!inn.players[playerSlot]) {
    var nameEl = document.getElementById(playerSlot+'name-'+matchId+'-'+teamId)
    var nm = nameEl ? nameEl.textContent : playerSlot
    inn.players[playerSlot] = { name: nm, runs: 0 }
  }

  inn.players[playerSlot].runs += runs
  inn.runs += runs

  // ball always counts
  inn.balls += 1

  var overCompleted = false
  if (inn.balls % BALLS_PER_OVER === 0) {
    inn.overs += 1
    overCompleted = true
  }

  // record
  m.history.push({
    type: 'run',
    teamId: teamId,
    playerSlot: playerSlot,
    runs: runs,
    overCompleted: overCompleted
  })

  updateInningsUI(matchId, teamId)
}


function addBowlerWicket(matchId, bowlingTeamId, bowlerSlot) {
  var m = matchState[matchId]
  if (!m.bowling[bowlingTeamId]) {
    m.bowling[bowlingTeamId] = { p1:0, p2:0 }
  }
  m.bowling[bowlingTeamId][bowlerSlot] += 1

  // record
  m.history.push({
    type: 'wicket',
    bowlingTeamId: bowlingTeamId,
    bowlerSlot: bowlerSlot
  })

  var span = document.getElementById('wb-'+matchId+'-'+bowlingTeamId+'-'+bowlerSlot)
  if (span) span.textContent = m.bowling[bowlingTeamId][bowlerSlot]
}


function oversToFloat(overs, balls) {
  var rem = balls % BALLS_PER_OVER
  return overs + (rem / 10)
}

function updateInningsUI(matchId, teamId) {
  var m = matchState[matchId]
  var inn = m.innings[teamId]

  document.getElementById('total-'+matchId+'-'+teamId).textContent = inn.runs + inn.extras
  document.getElementById('extras-'+matchId+'-'+teamId).textContent = inn.extras
  document.getElementById('over-'+matchId+'-'+teamId).textContent = oversToFloat(inn.overs, inn.balls).toFixed(1)

  var p1 = inn.players.p1 ? inn.players.p1.runs : 0
  var p2 = inn.players.p2 ? inn.players.p2.runs : 0
  document.getElementById('p1runs-'+matchId+'-'+teamId).textContent = p1 + ' runs'
  document.getElementById('p2runs-'+matchId+'-'+teamId).textContent = p2 + ' runs'
}

function resetMatch(matchId) {
  var m = matchState[matchId]
  var t1 = m.teams[0]
  var t2 = m.teams[1]
  matchState[matchId] = createEmptyMatch(t1, t2)
  updateInningsUI(matchId, t1)
  updateInningsUI(matchId, t2)
  var b1p1 = document.getElementById('wb-'+matchId+'-'+t1+'-p1')
  var b1p2 = document.getElementById('wb-'+matchId+'-'+t1+'-p2')
  var b2p1 = document.getElementById('wb-'+matchId+'-'+t2+'-p1')
  var b2p2 = document.getElementById('wb-'+matchId+'-'+t2+'-p2')
  if (b1p1) b1p1.textContent = '0'
  if (b1p2) b1p2.textContent = '0'
  if (b2p1) b2p1.textContent = '0'
  if (b2p2) b2p2.textContent = '0'
  var resultEl = document.getElementById('result-'+matchId)
  if (resultEl) resultEl.textContent = ''
  var momEl = document.getElementById('mom-'+matchId)
  if (momEl) momEl.value = ''
}


// ----------------------------------------
// finish match
// ----------------------------------------
function finishMatch(matchId) {
  var m = matchState[matchId]
  if (!m) return

  var t1 = m.teams[0]
  var t2 = m.teams[1]

  if (!m.bowling[t1]) m.bowling[t1] = { p1:0, p2:0 }
  if (!m.bowling[t2]) m.bowling[t2] = { p1:0, p2:0 }

  var t1Score = (m.innings[t1].runs || 0) + (m.innings[t1].extras || 0)
  var t2Score = (m.innings[t2].runs || 0) + (m.innings[t2].extras || 0)

  var t1Overs = (m.innings[t1].overs || 0) + ((m.innings[t1].balls || 0) % BALLS_PER_OVER)/BALLS_PER_OVER
  var t2Overs = (m.innings[t2].overs || 0) + ((m.innings[t2].balls || 0) % BALLS_PER_OVER)/BALLS_PER_OVER

  var t1WktsLost = (m.bowling[t2].p1 || 0) + (m.bowling[t2].p2 || 0)
  var t2WktsLost = (m.bowling[t1].p1 || 0) + (m.bowling[t1].p2 || 0)

  var result
  var marginText = ''

  if (t1Score > t2Score) {
    var diff = t1Score - t2Score
    marginText = 'won by ' + diff + ' runs'
    result = { winner: t1, loser: t2, tie: false, margin: marginText }
  } else if (t2Score > t1Score) {
    var remain = 2 - t2WktsLost
    if (remain < 0) remain = 0
    marginText = 'won by ' + remain + ' wicket' + (remain === 1 ? '' : 's')
    result = { winner: t2, loser: t1, tie: false, margin: marginText }
  } else {
    marginText = 'match tied'
    result = { tie: true, margin: marginText }
  }

  m.finished = true
  m.result = result

  // league table update (not for knockout ids)
  if (matchId !== 'PO' && matchId !== 'FINAL') {
    if (result.tie) {
      tableState[t1].played += 1
      tableState[t2].played += 1
      tableState[t1].draw += 1
      tableState[t2].draw += 1
      tableState[t1].points += 1
      tableState[t2].points += 1
    } else {
      tableState[result.winner].played += 1
      tableState[result.loser].played += 1
      tableState[result.winner].won += 1
      tableState[result.loser].lost += 1
      tableState[result.winner].points += 2
    }

    tableState[t1].runsFor += t1Score
    tableState[t1].oversFaced += t1Overs
    tableState[t1].runsAgainst += t2Score
    tableState[t1].oversBowled += t2Overs

    tableState[t2].runsFor += t2Score
    tableState[t2].oversFaced += t2Overs
    tableState[t2].runsAgainst += t1Score
    tableState[t2].oversBowled += t1Overs

    calcNRR()
    updatePointsTable()
  }

  // leaderboards
  pushRunsToBoard(m, t1)
  pushRunsToBoard(m, t2)
  pushWicketsToBoard(matchId, m, t1)
  pushWicketsToBoard(matchId, m, t2)
  renderLeaderboards()

  // auto MOM
  var momName = pickManOfMatch(m)
  var momEl = document.getElementById('mom-' + matchId)
  if (momEl && momName) momEl.value = momName

  // show result
  var resultEl = document.getElementById('result-' + matchId)
  if (resultEl) {
    if (result.tie) {
      resultEl.textContent = 'Result: Tie'
    } else {
      var winTeam = teams.find(function (x) { return x.id === result.winner })
      resultEl.textContent = 'Result: ' + winTeam.name + ' ' + result.margin
    }
  }

  // knockout chain
  if (matchId === 'PO' && m.result && !m.result.tie) {
    var playoffWinnerId = m.result.winner
    buildFinalAfterPlayoff(playoffWinnerId)
  }
}

function pickManOfMatch(m) {
  // safety check
  if (!m || !m.teams) return null;

  var best = { name: null, runs: -1, wkts: -1 };

  m.teams.forEach(function (tid) {
    var inn = m.innings[tid];
    var bowl = m.bowling[tid];

    // check both batters
    ['p1', 'p2'].forEach(function (slot) {
      var player = inn.players[slot];
      if (player) {
        var name = player.name;
        var runs = player.runs || 0;

        // find wickets taken by same player when bowling
        var wkts = 0;
        if (bowl && bowl[slot]) wkts = bowl[slot];

        // pick best (runs first, then wickets)
        if (
          runs > best.runs ||
          (runs === best.runs && wkts > best.wkts)
        ) {
          best = { name: name, runs: runs, wkts: wkts };
        }
      }
    });
  });

  return best.name;
}

// ----------------------------------------
// leaderboards
// ----------------------------------------
function pushRunsToBoard(matchObj, teamId) {
  var inn = matchObj.innings[teamId]
  if (!inn.players) return
  ;['p1','p2'].forEach(function(slot){
    if (inn.players[slot]) {
      var name = inn.players[slot].name
      var runs = inn.players[slot].runs
      if (!runBoard[name]) runBoard[name] = 0
      runBoard[name] += runs
    }
  })
}

function pushWicketsToBoard(matchId, matchObj, teamId) {
  var bowl = matchObj.bowling[teamId]
  if (!bowl) return
  ;['p1','p2'].forEach(function(slot){
    var taken = bowl[slot] || 0
    if (taken > 0) {
      var bowlerName = guessBowlerName(matchId, teamId, slot)
      if (!bowlerName) bowlerName = 'Player ' + slot
      if (!wicketBoard[bowlerName]) wicketBoard[bowlerName] = 0
      wicketBoard[bowlerName] += taken
    }
  })
}

function guessBowlerName(matchId, teamId, slot) {
  var nameEl = document.getElementById(slot+'name-'+matchId+'-'+teamId)
  return nameEl ? nameEl.textContent : null
}

function renderLeaderboards() {
  // runs
  var runArr = Object.keys(runBoard).map(function(name){
    return { name: name, val: runBoard[name] }
  })
  runArr.sort(function(a,b){ return b.val - a.val })
  runLeadersEl.innerHTML = ''
  if (runArr.length === 0) {
    runLeadersEl.innerHTML = '<p class="muted">No data yet</p>'
  } else {
    runArr.slice(0,5).forEach(function(it){
      var d = document.createElement('div')
      d.className = 'lb-item'
      d.innerHTML = '<span class="lb-name">'+it.name+'</span><span class="lb-val">'+it.val+'</span>'
      runLeadersEl.appendChild(d)
    })
  }

  // wickets
  var wArr = Object.keys(wicketBoard).map(function(name){
    return { name: name, val: wicketBoard[name] }
  })
  wArr.sort(function(a,b){ return b.val - a.val })
  wicketLeadersEl.innerHTML = ''
  if (wArr.length === 0) {
    wicketLeadersEl.innerHTML = '<p class="muted">No data yet</p>'
  } else {
    wArr.slice(0,5).forEach(function(it){
      var d2 = document.createElement('div')
      d2.className = 'lb-item'
      d2.innerHTML = '<span class="lb-name">'+it.name+'</span><span class="lb-val">'+it.val+'</span>'
      wicketLeadersEl.appendChild(d2)
    })
  }
}


// ----------------------------------------
// table and knockout
// ----------------------------------------
function calcNRR() {
  Object.keys(tableState).forEach(function(k){
    var t = tableState[k]
    var forRate = t.oversFaced > 0 ? (t.runsFor / t.oversFaced) : 0
    var agRate = t.oversBowled > 0 ? (t.runsAgainst / t.oversBowled) : 0
    t.nrr = forRate - agRate
  })
}

function updatePointsTable() {
  var arr = Object.keys(tableState).map(function(k){ return tableState[k]; })
  arr.sort(function(a,b){
    if (b.points !== a.points) return b.points - a.points
    return b.nrr - a.nrr
  })
  pointsTableBody.innerHTML = ''
  arr.forEach(function(t, i){
    var meta = teams.find(function(x){ return x.id === t.teamId; })
    var tr = document.createElement('tr')
    tr.innerHTML =
      '<td>'+(i+1)+'</td>'+
      '<td>'+(meta ? meta.name : t.teamId)+'</td>'+
      '<td>'+t.played+'</td>'+
      '<td>'+t.won+'</td>'+
      '<td>'+t.draw+'</td>'+
      '<td>'+t.lost+'</td>'+
      '<td>'+t.points+'</td>'+
      '<td>'+t.nrr.toFixed(2)+'</td>'
    pointsTableBody.appendChild(tr)
  })

  if (arr.length === 4) {
    var first = arr[0], second = arr[1], third = arr[2]
    var firstName = teams.find(function(t){ return t.id === first.teamId; }).name
    var secondName = teams.find(function(t){ return t.id === second.teamId; }).name
    var thirdName = teams.find(function(t){ return t.id === third.teamId; }).name

    knockoutInfo.textContent = firstName + ' to Final. ' + secondName + ' vs ' + thirdName + ' playoff.'
    renderKnockoutFixtures(first, second, third)
    buildKnockoutMatchCards(first.teamId, second.teamId, third.teamId)
  } else {
    knockoutInfo.textContent = ''
    if (knockoutWrap) knockoutWrap.innerHTML = ''
  }
}

function renderKnockoutFixtures(first, second, third) {
  var kf = document.getElementById('knockoutFixtures')
  if (!kf) return
  var firstTeam = teams.find(function(t){ return t.id === first.teamId; })
  var secondTeam = teams.find(function(t){ return t.id === second.teamId; })
  var thirdTeam = teams.find(function(t){ return t.id === third.teamId; })

  kf.innerHTML =
    '<div class="fixture-card" style="margin-top:.35rem;padding:.4rem .5rem;">' +
      '<p class="muted" style="margin:0 0 .25rem;">Playoff</p>' +
      '<strong>' + secondTeam.name + '</strong> vs <strong>' + thirdTeam.name + '</strong>' +
      '<p class="muted" style="margin:.25rem 0 0;font-size:.6rem;">Winner → Final</p>' +
    '</div>' +
    '<div class="fixture-card" style="margin-top:.35rem;padding:.4rem .5rem;">' +
      '<p class="muted" style="margin:0 0 .25rem;">Final</p>' +
      '<strong>' + firstTeam.name + '</strong> vs <strong>Winner of Playoff</strong>' +
      '<p class="muted" style="margin:.25rem 0 0;font-size:.6rem;">Auto-updates with table</p>' +
    '</div>'
}

function buildKnockoutMatchCards(firstId, secondId, thirdId) {
  if (!knockoutWrap) return
  knockoutWrap.innerHTML = ''

  var playoffCard = createKnockoutFixtureCard('PO', secondId, thirdId)
  knockoutWrap.appendChild(playoffCard)

  currentFinalHost = firstId

  var finalCard = createKnockoutFixtureCard('FINAL', firstId, null)
  knockoutWrap.appendChild(finalCard)

  matchState['PO'] = createEmptyMatch(secondId, thirdId)
  matchState['FINAL'] = createEmptyMatch(firstId, firstId)
}

function createKnockoutFixtureCard(matchId, teamAId, teamBId) {
  var alloc = currentAlloc || {}
  var card = document.createElement('div')
  card.className = 'fixture-card'
  card.id = 'card-' + matchId

  var teamA = teams.find(function(t){ return t.id === teamAId; })
  var teamB = teamBId ? teams.find(function(t){ return t.id === teamBId; }) : null

  var head = document.createElement('div')
  head.className = 'match-title'
  var headHtml = ''
  if (teamA) {
    headHtml += teamLogoHTML(teamA) + '<div><strong>'+teamA.name+'</strong></div>'
  }
  headHtml += '<div class="vs">vs</div>'
  if (teamB) {
    headHtml += teamLogoHTML(teamB) + '<div><strong>'+teamB.name+'</strong></div>'
  } else {
    headHtml += '<div><strong>TBD</strong></div>'
  }
  headHtml += '<span class="muted" style="font-size:.6rem;margin-left:.4rem;">'+matchId+'</span>'
  head.innerHTML = headHtml

  var wrap = document.createElement('div')
  wrap.className = 'inning-wrap'

  if (teamA && teamB) {
    wrap.appendChild(createInningsPanel(matchId, teamA, alloc[teamAId], teamB, alloc[teamBId]))
    wrap.appendChild(createInningsPanel(matchId, teamB, alloc[teamBId], teamA, alloc[teamAId]))
  } else if (teamA && !teamB) {
    var tempOpp = { id: 'TBD', name: 'TBD', color: '#475569' }
    wrap.appendChild(createInningsPanel(matchId, teamA, alloc[teamAId], tempOpp, null))
    wrap.appendChild(createInningsPanel(matchId, tempOpp, null, teamA, alloc[teamAId]))
  }

  var btm = document.createElement('div')
  btm.style.marginTop = '.4rem'
  btm.style.display = 'flex'
  btm.style.flexDirection = 'column'
  btm.style.alignItems = 'center'

btm.innerHTML =
  '<div class="result-line" id="result-' + matchId + '"></div>' +
  '<input class="mom-input" id="mom-' + matchId + '" placeholder="Man of the match" />' +

  // new div wrapper for the action buttons
  '<div class="match-actions" style="display:flex;gap:.5rem;margin-top:.4rem;justify-content: center;">' +

    '<button class="mini-btn" data-role="finish" data-match="' + matchId + '"' +
      ' title="Save match"' +
      'style="color: #22c55e;gap: 2px;font-size: 10px;display: flex;background:rgba(34,197,94,.12);border: 1px solid #22c55e;flex-direction: column;align-items: center;">' +
        '<img src="save.png" alt="Save" style="width:20px;height:20px;vertical-align:middle;">' +
		'Save'+
    '</button>' +

    '<button class="mini-btn" data-role="undo" data-match="' + matchId + '"' +
      ' title="Undo last action"' +
      'style="display: flex;color: #38bdf8;background:rgba(56,189,248,.08);font-size: 10px;border:1px solid rgba(56,189,248,.3);flex-direction: column;align-items: center;gap: 2px">' +
        '<img src="undo.png" alt="Undo" style="width:20px;height:20px;vertical-align:middle;">' +
		'Undo'+
    '</button>' +

    '<button class="mini-btn" data-role="reset" data-match="' + matchId + '"' +
      ' title="Reset match"' +
      'style="display: flex;color: #f43f5e;background:rgba(244,63,94,.1);font-size: 10px;border:1px solid rgba(244,63,94,.3);flex-direction: column;align-items: center;gap: 2px;">' +
        '<img src="reset.png" alt="Reset" style="width:20px;height:20px;vertical-align:middle;">' +
		'Reset'+
    '</button>' +

  '</div>';


  card.appendChild(head)
  card.appendChild(wrap)
  card.appendChild(btm)
  return card
}

function buildFinalAfterPlayoff(playoffWinnerId) {
  if (!knockoutWrap) return
  if (!currentFinalHost) return

  var oldFinal = document.getElementById('card-FINAL')
  if (oldFinal) oldFinal.remove()

  var finalCard = createKnockoutFixtureCard('FINAL', currentFinalHost, playoffWinnerId)
  knockoutWrap.appendChild(finalCard)

  matchState['FINAL'] = createEmptyMatch(currentFinalHost, playoffWinnerId)
}

function undoLastAction(matchId) {
  var m = matchState[matchId]
  if (!m || !m.history || m.history.length === 0) return

  var last = m.history.pop()

  if (last.type === 'extra') {
    var inn = m.innings[last.teamId]
    inn.extras = Math.max(0, inn.extras - last.amount)
    updateInningsUI(matchId, last.teamId)
  }

  else if (last.type === 'run') {
    var inn2 = m.innings[last.teamId]
    // remove runs
    inn2.runs = Math.max(0, inn2.runs - last.runs)
    // remove from player
    if (inn2.players[last.playerSlot]) {
      inn2.players[last.playerSlot].runs = Math.max(0, inn2.players[last.playerSlot].runs - last.runs)
    }
    // remove ball
    if (inn2.balls > 0) {
      inn2.balls -= 1
    }
    // remove over if we created it
    if (last.overCompleted && inn2.overs > 0) {
      inn2.overs -= 1
    }
    updateInningsUI(matchId, last.teamId)
  }

  else if (last.type === 'wicket') {
    var bw = m.bowling[last.bowlingTeamId]
    if (bw && bw[last.bowlerSlot] > 0) {
      bw[last.bowlerSlot] -= 1
    }
    var span = document.getElementById('wb-'+matchId+'-'+last.bowlingTeamId+'-'+last.bowlerSlot)
    if (span) span.textContent = bw[last.bowlerSlot]
  }

  // if you had already finished the match, undo won't re-edit the table.
  // this is safer: user should reset or manually fix result.
}


// ----------------------------------------
// start
// ----------------------------------------
renderTeamsBar()
renderPlayersPool()
initTableState(tableOrder)
renderLeaderboards()

document.getElementById('runLotteryBtn').addEventListener('click', runLottery)
