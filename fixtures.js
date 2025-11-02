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
var runBoard = {}     // {playerName: totalRuns}
var wicketBoard = {}  // {playerName: totalWickets}

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
var currentAlloc = {}     // store last lottery allocations for later
var currentFinalHost = null  // 1st place team id



// ----- HELPERS -----

function renderKnockoutFixtures(first, second, third) {
  var kf = document.getElementById('knockoutFixtures');
  if (!kf) return;
  var firstTeam = teams.find(function(t){ return t.id === first.teamId; });
  var secondTeam = teams.find(function(t){ return t.id === second.teamId; });
  var thirdTeam = teams.find(function(t){ return t.id === third.teamId; });

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
    '</div>';
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

    var logo = document.createElement('div')
    logo.className = 'logo'
    if (t.logoUrl) {
      var img = document.createElement('img')
      img.src = t.logoUrl
      img.alt = t.name
      logo.appendChild(img)
    } else {
      logo.style.background = t.color
      logo.textContent = t.logoText
    }

    var span = document.createElement('span')
    span.textContent = t.name
    div.appendChild(logo)
    div.appendChild(span)
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
    var slot = document.createElement('div')
    slot.className = 'team-slot'

    var cap = (alloc[t.id] && alloc[t.id].captain) ? alloc[t.id].captain : '---'
    var vice = (alloc[t.id] && alloc[t.id].vice) ? alloc[t.id].vice : '---'

    // logo html with image support
    var logoHtml
    if (t.logoUrl) {
      logoHtml =
        '<span class="logo" style="margin-right:.4rem;">' +
          '<img src="'+t.logoUrl+'" alt="'+t.name+'" style="height:45px;object-fit:cover;" />' +
        '</span>'
    } else {
      var initials = t.logoText || t.name.slice(0, 2).toUpperCase()
      logoHtml =
        '<span class="logo" style="background:'+t.color+';margin-right:.4rem;">'+initials+'</span>'
    }

    slot.innerHTML =
      '<div style="display:flex;align-items:center;margin-bottom:.35rem;">' +
        logoHtml +
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

// ----- LOTTERY -----
function runLottery() {
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

  // remember for knockout cards
  currentAlloc = allocations

  renderTeamAllocations(allocations)
  renderPlayersPool(assignedMap)

  tableOrder = shuffle(teams.map(function(t){ return t.id }))
  initTableState(tableOrder)

  generateFixtures(allocations)

  // clear knockout on new lottery
  if (knockoutWrap) knockoutWrap.innerHTML = ''

}


// ----- FIXTURES -----
function createEmptyMatch(teamA, teamB) {
  var m = {
    teams: [teamA, teamB],
    innings: {},
    bowling: {}
  }
  m.innings[teamA] = { runs:0, extras:0, balls:0, overs:0, players:{}, wickets:'' }
  m.innings[teamB] = { runs:0, extras:0, balls:0, overs:0, players:{}, wickets:'' }
  // bowling side wickets
  m.bowling[teamA] = { p1:0, p2:0 }
  m.bowling[teamB] = { p1:0, p2:0 }
  m.finished = false
  m.result = null
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

  // build logo html with image support
function logoHTML(team) {
  if (team.logoUrl) {
    return `
      <div class="logo">
        <img src="${team.logoUrl}" alt="${team.name}">
      </div>
    `;
  }
  const initials = team.logoText || team.name.slice(0, 2).toUpperCase();
  return `<div class="logo" style="background:${team.color};">${initials}</div>`;
}


  var head = document.createElement('div')
  head.className = 'match-title'
  head.innerHTML =
    logoHTML(teamA) +
    '<div><strong>'+teamA.name+'</strong></div>' +
    '<div class="vs">vs</div>' +
    logoHTML(teamB) +
    '<div><strong>'+teamB.name+'</strong></div>' +
    '<span class="muted" style="font-size:.6rem;">'+matchId+'</span>'

  var wrap = document.createElement('div')
  wrap.className = 'inning-wrap'
  // pass opponent so we can show wicket + buttons
  wrap.appendChild(createInningsPanel(matchId, teamA, alloc[teamAId], teamB, alloc[teamBId]))
  wrap.appendChild(createInningsPanel(matchId, teamB, alloc[teamBId], teamA, alloc[teamAId]))

  var btm = document.createElement('div')
  btm.style.marginTop = '.4rem'
  btm.innerHTML =
    '<div class="result-line" id="result-'+matchId+'"></div>' +
    '<input class="mom-input" id="mom-'+matchId+'" placeholder="Man of the match" /> ' +
    '<button class="mini-btn" data-role="finish" data-match="'+matchId+'" style="background:rgba(34,197,94,.16);border:1px solid rgba(34,197,94,.4);color:#ecfdf3;">Save match</button> ' +
    '<button class="mini-btn" data-role="reset" data-match="'+matchId+'" style="background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);color:#fee2e2;">Reset</button>'

  card.appendChild(head)
  card.appendChild(wrap)
  card.appendChild(btm)
  return card
}


function createInningsPanel(matchId, team, allocation, opponentTeam, opponentAlloc) {
  var captain = (allocation && allocation.captain) ? allocation.captain : 'Player 1'
  var vice = (allocation && allocation.vice) ? allocation.vice : 'Player 2'

  var oppId = opponentTeam.id
  var oppName = opponentTeam.name
  var oCap = (opponentAlloc && opponentAlloc.captain) ? opponentAlloc.captain : 'Bowler 1'
  var oVice = (opponentAlloc && opponentAlloc.vice) ? opponentAlloc.vice : 'Bowler 2'

  // make a logo snippet that supports png
  function miniLogoHTML(t) {
    if (t.logoUrl) {
      return '<span class="logo" style="margin-right:.35rem;"><img src="'+t.logoUrl+'" alt="'+t.name+'" style="width:15%;height:100%;object-fit:cover;" /></span>'
    }
    return '<span class="logo" style="background:'+t.color+';margin-right:.35rem;">'+t.logoText+'</span>'
  }

  var panel = document.createElement('div')
  panel.className = 'score-panel'
  panel.innerHTML =
    '<p class="muted" style="margin:0 0 .3rem;font-size:.62rem;">' +
      miniLogoHTML(team) +
      team.name + ' batting' +
    '</p>' +
    '<div class="score-row">' +
      '<label>Total</label>' +
      '<div class="score-badge" id="total-'+matchId+'-'+team.id+'">0</div>' +
    '</div>' +
    '<div class="score-row">' +
      '<label>Extras</label>' +
      '<div class="score-badge" id="extras-'+matchId+'-'+team.id+'">0</div>' +
      '<button class="mini-btn" data-role="add-extra" data-match="'+matchId+'" data-team="'+team.id+'">+1</button>' +
    '</div>' +
    '<div class="score-row">' +
      '<label>Over</label>' +
      '<div class="score-badge" id="over-'+matchId+'-'+team.id+'">0.0</div>' +
      '<span class="muted" style="font-size:.55rem;">(3 balls)</span>' +
    '</div>' +
    '<div class="players-run" style="margin-top:.35rem;">' +
      '<div>' +
        '<h5 id="p1name-'+matchId+'-'+team.id+'">'+captain+'</h5>' +
        '<div class="muted" id="p1runs-'+matchId+'-'+team.id+'">0 runs</div>' +
        '<div style="display:flex;gap:.25rem;margin-top:.25rem;flex-wrap:wrap;">' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p1" data-runs="0">0</button>' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p1" data-runs="1">1</button>' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p1" data-runs="2">2</button>' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p1" data-runs="4">4</button>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<h5 id="p2name-'+matchId+'-'+team.id+'">'+vice+'</h5>' +
        '<div class="muted" id="p2runs-'+matchId+'-'+team.id+'">0 runs</div>' +
        '<div style="display:flex;gap:.25rem;margin-top:.25rem;flex-wrap:wrap;">' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p2" data-runs="0">0</button>' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p2" data-runs="1">1</button>' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p2" data-runs="2">2</button>' +
          '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+team.id+'" data-player="p2" data-runs="4">4</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bowling-wrap">' +
      '<h6>Wickets by '+oppName+'</h6>' +
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
    '</div>'
  return panel
}



// ----- SCORE EVENTS -----
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
  }
})

fixturesWrap.addEventListener('input', function(e){
  if (e.target.dataset.role === 'wickets') {
    var matchId = e.target.dataset.match
    var teamId = e.target.dataset.team
    matchState[matchId].innings[teamId].wickets = e.target.value
  }
})

function addExtraRun(matchId, teamId) {
  var m = matchState[matchId]
  m.innings[teamId].extras += 1
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
  if (inn.balls % BALLS_PER_OVER === 0) {
    inn.overs += 1
  }
  updateInningsUI(matchId, teamId)
}

function addBowlerWicket(matchId, bowlingTeamId, bowlerSlot) {
  var m = matchState[matchId]
  if (!m.bowling[bowlingTeamId]) {
    m.bowling[bowlingTeamId] = { p1:0, p2:0 }
  }
  m.bowling[bowlingTeamId][bowlerSlot] += 1
  // update UI
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

  var ta = document.querySelector('#card-'+matchId+' textarea[data-team="'+teamId+'"]')
  if (ta && ta.value !== inn.wickets) {
    ta.value = inn.wickets || ''
  }
}

function resetMatch(matchId) {
  var m = matchState[matchId]
  var t1 = m.teams[0]
  var t2 = m.teams[1]
  matchState[matchId] = createEmptyMatch(t1, t2)
  updateInningsUI(matchId, t1)
  updateInningsUI(matchId, t2)
  // reset bowling ui
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

function finishMatch(matchId) {
  var m = matchState[matchId]
  if (!m) return

  var t1 = m.teams[0]
  var t2 = m.teams[1]

  // safety: bowling objects might not exist yet
  if (!m.bowling[t1]) m.bowling[t1] = { p1:0, p2:0 }
  if (!m.bowling[t2]) m.bowling[t2] = { p1:0, p2:0 }

  var t1Score = (m.innings[t1].runs || 0) + (m.innings[t1].extras || 0)
  var t2Score = (m.innings[t2].runs || 0) + (m.innings[t2].extras || 0)

  var t1Overs = (m.innings[t1].overs || 0) + ((m.innings[t1].balls || 0) % BALLS_PER_OVER)/BALLS_PER_OVER
  var t2Overs = (m.innings[t2].overs || 0) + ((m.innings[t2].balls || 0) % BALLS_PER_OVER)/BALLS_PER_OVER

  var result
  var marginText = ''

  // wickets lost = wickets taken by opponent
  var t1WktsLost = (m.bowling[t2].p1 || 0) + (m.bowling[t2].p2 || 0)
  var t2WktsLost = (m.bowling[t1].p1 || 0) + (m.bowling[t1].p2 || 0)

  if (t1Score > t2Score) {
    var diff = t1Score - t2Score
    marginText = 'won by ' + diff + ' runs'
    result = { winner: t1, loser: t2, tie: false, margin: marginText }
  } else if (t2Score > t1Score) {
    // max wickets = 2 because you have 2 batters
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

  // ---------- LEAGUE TABLE UPDATE ----------
  // only update table for normal group matches
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

  // ---------- LEADERBOARDS ----------
  pushRunsToBoard(m, t1)
  pushRunsToBoard(m, t2)
  pushWicketsToBoard(matchId, m, t1)
  pushWicketsToBoard(matchId, m, t2)
  renderLeaderboards()

  // ---------- AUTO MOM ----------
  var momName = pickManOfMatch(m)
  var momEl = document.getElementById('mom-' + matchId)
  if (momEl && momName) momEl.value = momName

  // ---------- SHOW RESULT ON CARD ----------
  var resultEl = document.getElementById('result-' + matchId)
  if (resultEl) {
    if (result.tie) {
      resultEl.textContent = 'Result: Tie'
    } else {
      var winTeam = teams.find(function (x) { return x.id === result.winner })
      resultEl.textContent = 'Result: ' + winTeam.name + ' ' + result.margin
    }
  }

  // ---------- KNOCKOUT CHAIN ----------
  // if playoff is done, lock the winner into FINAL
  if (matchId === 'PO' && m.result && !m.result.tie) {
    var playoffWinnerId = m.result.winner
    buildFinalAfterPlayoff(playoffWinnerId)
  }
}


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

  ['p1','p2'].forEach(function(slot){
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


function pickManOfMatch(m) {
  // pick highest run scorer; if tie, highest wickets
  var best = { name: null, runs: -1, wkts: -1 }
  m.teams.forEach(function(tid){
    var inn = m.innings[tid]
    if (inn.players.p1) {
      var r = inn.players.p1.runs
      var w = 0
      // wickets taken by this player (when team bowled)
      var bw = m.bowling[tid] ? (slotIs('p1', m.bowling[tid]) ? m.bowling[tid].p1 : 0) : 0
      if (r > best.runs || (r === best.runs && bw > best.wkts)) {
        best = { name: inn.players.p1.name, runs: r, wkts: bw }
      }
    }
    if (inn.players.p2) {
      var r2 = inn.players.p2.runs
      var w2 = m.bowling[tid] ? (slotIs('p2', m.bowling[tid]) ? m.bowling[tid].p2 : 0) : 0
      if (r2 > best.runs || (r2 === best.runs && w2 > best.wkts)) {
        best = { name: inn.players.p2.name, runs: r2, wkts: w2 }
      }
    }
  })
  return best.name
}

function slotIs(s, obj) {
  return Object.prototype.hasOwnProperty.call(obj, s)
}

function calcNRR() {
  var keys = Object.keys(tableState)
  keys.forEach(function(k){
    var t = tableState[k]
    var forRate = t.oversFaced > 0 ? (t.runsFor / t.oversFaced) : 0
    var agRate = t.oversBowled > 0 ? (t.runsAgainst / t.oversBowled) : 0
    t.nrr = forRate - agRate
  })
}

function updatePointsTable() {
  var arr = Object.keys(tableState).map(function(k){ return tableState[k]; });
  arr.sort(function(a,b){
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  pointsTableBody.innerHTML = '';
  arr.forEach(function(t, i){
    var meta = teams.find(function(x){ return x.id === t.teamId; });
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>'+(i+1)+'</td>'+
      '<td>'+(meta ? meta.name : t.teamId)+'</td>'+
      '<td>'+t.played+'</td>'+
      '<td>'+t.won+'</td>'+
      '<td>'+t.draw+'</td>'+
      '<td>'+t.lost+'</td>'+
      '<td>'+t.points+'</td>'+
      '<td>'+t.nrr.toFixed(2)+'</td>';
    pointsTableBody.appendChild(tr);
  });

  if (arr.length === 4) {
    var first = arr[0], second = arr[1], third = arr[2];
    var firstName = teams.find(function(t){ return t.id === first.teamId; }).name;
    var secondName = teams.find(function(t){ return t.id === second.teamId; }).name;
    var thirdName = teams.find(function(t){ return t.id === third.teamId; }).name;

    knockoutInfo.textContent = firstName + ' to Final. ' + secondName + ' vs ' + thirdName + ' playoff.';
    renderKnockoutFixtures(first, second, third);   // your text version
    buildKnockoutMatchCards(first.teamId, second.teamId, third.teamId);
  } else {
    knockoutInfo.textContent = '';
    if (knockoutWrap) knockoutWrap.innerHTML = '';
  }
}



function renderLeaderboards() {
  // runs
  var runArr = Object.keys(runBoard).map(function(name){
    return { name: name, val: runBoard[name] }
  })
  runArr.sort(function(a,b){ return b.val - a.val })
  runLeadersEl.innerHTML = ''
  runArr.slice(0,5).forEach(function(it){
    var d = document.createElement('div')
    d.className = 'lb-item'
    d.innerHTML = '<span class="lb-name">'+it.name+'</span><span class="lb-val">'+it.val+'</span>'
    runLeadersEl.appendChild(d)
  })
  if (runArr.length === 0) {
    runLeadersEl.innerHTML = '<p class="muted">No data yet</p>'
  }

  // wickets
  var wArr = Object.keys(wicketBoard).map(function(name){
    return { name: name, val: wicketBoard[name] }
  })
  wArr.sort(function(a,b){ return b.val - a.val })
  wicketLeadersEl.innerHTML = ''
  wArr.slice(0,5).forEach(function(it){
    var d2 = document.createElement('div')
    d2.className = 'lb-item'
    d2.innerHTML = '<span class="lb-name">'+it.name+'</span><span class="lb-val">'+it.val+'</span>'
    wicketLeadersEl.appendChild(d2)
  })
  if (wArr.length === 0) {
    wicketLeadersEl.innerHTML = '<p class="muted">No data yet</p>'
  }
}


function buildKnockoutMatchCards(firstId, secondId, thirdId) {
  if (!knockoutWrap) return;
  knockoutWrap.innerHTML = '';

  // 1) playoff card: 2nd vs 3rd
  var playoffCard = createKnockoutFixtureCard('PO', secondId, thirdId);
  knockoutWrap.appendChild(playoffCard);

  // remember who is straight in the final
  currentFinalHost = firstId;

  // 2) final card: 1st vs TBD (we'll set team2 when playoff is done)
  var finalCard = createKnockoutFixtureCard('FINAL', firstId, null);
  knockoutWrap.appendChild(finalCard);

  // create empty match states
  matchState['PO'] = createEmptyMatch(secondId, thirdId);
  matchState['FINAL'] = createEmptyMatch(firstId, firstId); // temp, will update after playoff
}


function createKnockoutFixtureCard(matchId, teamAId, teamBId) {
  var alloc = currentAlloc || {};
  var card = document.createElement('div');
  card.className = 'fixture-card';
  card.id = 'card-' + matchId;

  var teamA = teams.find(function(t){ return t.id === teamAId; });
  var teamB = teamBId ? teams.find(function(t){ return t.id === teamBId; }) : null;

  var headHtml = '';
  if (teamA) {
    headHtml += '<div class="logo" style="background:'+teamA.color+';">'+teamA.logoText+'</div><div><strong>'+teamA.name+'</strong></div>';
  }
  headHtml += '<div class="vs">vs</div>';
  if (teamB) {
    headHtml += '<div class="logo" style="background:'+teamB.color+';">'+teamB.logoText+'</div><div><strong>'+teamB.name+'</strong></div>';
  } else {
    headHtml += '<div><strong>TBD</strong></div>';
  }

  var head = document.createElement('div');
  head.className = 'match-title';
  head.innerHTML = headHtml + '<span class="muted" style="font-size:.6rem;margin-left:.4rem;">'+matchId+'</span>';

  var wrap = document.createElement('div');
  wrap.className = 'inning-wrap';

  if (teamA && teamB) {
    wrap.appendChild(createInningsPanel(matchId, teamA, alloc[teamAId], teamB, alloc[teamBId]));
    wrap.appendChild(createInningsPanel(matchId, teamB, alloc[teamBId], teamA, alloc[teamAId]));
  } else if (teamA && !teamB) {
    // final card before playoff result: show one side only
    var tempOpp = { id: 'TBD', name: 'TBD', color: '#475569', logoText: '?' };
    wrap.appendChild(createInningsPanel(matchId, teamA, alloc[teamAId], tempOpp, null));
    wrap.appendChild(createInningsPanel(matchId, tempOpp, null, teamA, alloc[teamAId]));
  }

  var btm = document.createElement('div');
  btm.style.marginTop = '.4rem';
  btm.innerHTML =
    '<div class="result-line" id="result-'+matchId+'"></div>' +
    '<input class="mom-input" id="mom-'+matchId+'" placeholder="Man of the match" /> ' +
    '<button class="mini-btn" data-role="finish" data-match="'+matchId+'" style="font-size: 15px;background:rgba(34,197,94,.16);border:1px solid rgba(34,197,94,.4);color:#ecfdf3;">Save match</button> ' +	
    '<button class="mini-btn" data-role="reset" data-match="'+matchId+'" style="background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);font-size:15px;color:#fee2e2;">Reset</button>';

  card.appendChild(head);
  card.appendChild(wrap);
  card.appendChild(btm);
  return card;
}

function buildFinalAfterPlayoff(playoffWinnerId) {
  if (!knockoutWrap) return;
  if (!currentFinalHost) return;

  // replace FINAL card
  var oldFinal = document.getElementById('card-FINAL');
  if (oldFinal) oldFinal.remove();

  var finalCard = createKnockoutFixtureCard('FINAL', currentFinalHost, playoffWinnerId);
  knockoutWrap.appendChild(finalCard);

  // reset matchState for final with correct teams
  matchState['FINAL'] = createEmptyMatch(currentFinalHost, playoffWinnerId);
}


// ----- START -----
renderTeamsBar()
renderPlayersPool()
initTableState(tableOrder)
renderLeaderboards()

document.getElementById('runLotteryBtn').addEventListener('click', runLottery)
