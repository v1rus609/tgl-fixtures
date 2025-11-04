// ----- DATA -----
var teams = [
  { id: 'UMA',   name: 'UMA',       color: '#f97316', logoUrl: 'uma.png' },
  { id: 'NJL',   name: 'NJL',       color: '#38bdf8', logoUrl: 'njl.png' },
  { id: 'VAT69', name: 'VAT69',     color: '#a855f7', logoUrl: 'vat.png' },
  { id: 'FAKE',  name: 'Fake Taxi', color: '#facc15', logoUrl: 'ft.png' }
]

// players will be added manually from UI
var players = []

// leaderboards
var runBoard    = {}
var wicketBoard = {}
var potmBoard   = {}

// state
var tableState       = {}
var matchState       = {}
var tableOrder       = teams.map(function (t) { return t.id })
var BALLS_PER_OVER   = 3
var currentAlloc     = {}
var currentFinalHost = null

// ----- DOM ELEMENTS -----
var teamsBar         = document.getElementById('teamsBar')
var playersPool      = document.getElementById('playersPool')
var teamAllocations  = document.getElementById('teamAllocations')
var fixturesWrap     = document.getElementById('fixturesWrap')
var pointsTableBody  = document.querySelector('#pointsTable tbody')
var knockoutInfo     = document.getElementById('knockoutInfo')
var fixtureNote      = document.getElementById('fixtureNote')
var runLeadersEl     = document.getElementById('runLeaders')
var wicketLeadersEl  = document.getElementById('wicketLeaders')
var potmLeadersEl    = document.getElementById('potmLeaders')
var knockoutWrap     = document.getElementById('knockoutWrap')
var knockoutFixtures = document.getElementById('knockoutFixtures')
var champOverlay  = document.getElementById('champOverlay')
var champTeamEl   = document.getElementById('champTeam')
var closeChampBtn = document.getElementById('closeChamp')

// optional: simple fixture list in sidebar
var fixturesListEl   = document.getElementById('fixturesList')

// add team/player controls (if present)
var addTeamBtn        = document.getElementById('addTeamBtn')
var newTeamNameInput  = document.getElementById('newTeamName')
var addPlayerBtn      = document.getElementById('addPlayerBtn')
var newPlayerNameInput = document.getElementById('newPlayerName')


// ----- SOUND EFFECTS -----
var sfxFour   = new Audio('four.mp3')
var sfxWicket = new Audio('wicket.mp3')
var sfxWin    = new Audio('win.mp3')


// ----------------------------------------
// helpers
// ----------------------------------------
function randomColor() {
  var palette = ['#f97316', '#38bdf8', '#a855f7', '#22c55e', '#ef4444', '#eab308', '#0ea5e9', '#6366f1']
  return palette[Math.floor(Math.random() * palette.length)]
}

function shuffle(arr) {
  return arr
    .map(function (x) { return { v: x, r: Math.random() } })
    .sort(function (a, b) { return a.r - b.r })
    .map(function (o) { return o.v })
}

function teamLogoHTML(team, sizePx) {
  var size = sizePx || 35
  if (team.logoUrl) {
    return (
      '<div class="logo" style="width:'+size+'px;height:'+size+'px;">' +
        '<img src="'+team.logoUrl+'" alt="'+team.name+'" style="width:100%;height:100%;object-fit:cover;" />' +
      '</div>'
    )
  }
  var initials = (team.logoText || team.name.slice(0, 2)).toUpperCase()
  return (
    '<div class="logo" style="background:'+(team.color || randomColor())+';width:'+size+'px;height:'+size+'px;display:flex;align-items:center;justify-content:center;font-weight:600;border-radius:999px;">' +
      initials +
    '</div>'
  )
}

function renderTeamsBar() {
  teamsBar.innerHTML = ''
  teams.forEach(function (t) {
    var div = document.createElement('div')
    div.className = 'team-pill'
    div.innerHTML = teamLogoHTML(t, 30) + '<span>'+t.name+'</span>'
    teamsBar.appendChild(div)
  })
}

function renderPlayersPool(assignedMap) {
  assignedMap = assignedMap || {}
  playersPool.innerHTML = ''
  players.forEach(function (p) {
    var d = document.createElement('div')
    d.textContent = p
    if (assignedMap[p]) d.classList.add('assigned')
    playersPool.appendChild(d)
  })
}

function renderTeamAllocations(alloc) {
  teamAllocations.innerHTML = ''
  teams.forEach(function (t) {
    var cap  = alloc[t.id] && alloc[t.id].captain ? alloc[t.id].captain : '---'
    var vice = alloc[t.id] && alloc[t.id].vice    ? alloc[t.id].vice    : '---'

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
  order.forEach(function (id) {
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

function playSfx(audio) {
  if (!audio) return
  // restart from beginning so quick repeats still work
  audio.currentTime = 0
  audio.play().catch(function () {
    // ignore autoplay errors, user clicks should be enough
  })
}

// ----------------------------------------
// fixture generation (round-robin, no self matches)
// ----------------------------------------
function fixturePairs() {
  var ids = teams.map(function (t) { return t.id })
  if (ids.length < 2) return []

  // shuffle so UMA isn't always first
  ids = shuffle(ids.slice())

  var BYE = '__BYE__'
  if (ids.length % 2 === 1) {
    ids.push(BYE)
  }

  var n       = ids.length
  var half    = n / 2
  var rounds  = n - 1
  var schedule = []
  var arr     = ids.slice()

  for (var r = 0; r < rounds; r++) {
    for (var i = 0; i < half; i++) {
      var t1 = arr[i]
      var t2 = arr[n - 1 - i]
      if (t1 === BYE || t2 === BYE) continue
      schedule.push([t1, t2])
    }

    // rotate except first
    var fixed = arr[0]
    var rest  = arr.slice(1)
    rest.unshift(rest.pop())
    arr = [fixed].concat(rest)
  }

  return schedule
}

function renderFixtureList(pairs) {
  if (!fixturesListEl) return
  fixturesListEl.innerHTML = ''

  if (!pairs || pairs.length === 0) {
    fixturesListEl.innerHTML = '<p class="muted tiny">No fixtures yet. Run the lottery.</p>'
    return
  }

  pairs.forEach(function (p, index) {
    var t1 = teams.find(function (t) { return t.id === p[0] })
    var t2 = teams.find(function (t) { return t.id === p[1] })
    if (!t1 || !t2) return

    var row = document.createElement('div')
    row.className = 'fixture-list-item'
    row.innerHTML =
      '<span class="code">M'+(index+1)+'</span>' +
      '<span class="teams">'+t1.name+' vs '+t2.name+'</span>'
    fixturesListEl.appendChild(row)
  })
}


// ----------------------------------------
// add team / player from UI
// ----------------------------------------
function normaliseTeamId(name) {
  var base = (name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (!base) base = 'T'
  base = base.slice(0, 3)
  var id = base
  var i = 1
  while (teams.some(function (t) { return t.id === id })) {
    id = base + i
    i++
  }
  return id
}

function addTeamFromInput() {
  if (!newTeamNameInput) return
  var name = (newTeamNameInput.value || '').trim()
  if (!name) return

  var id = normaliseTeamId(name)
  teams.push({
    id: id,
    name: name,
    color: randomColor()
  })

  newTeamNameInput.value = ''
  renderTeamsBar()
}

function addPlayerFromInput() {
  if (!newPlayerNameInput) return
  var name = (newPlayerNameInput.value || '').trim()
  if (!name) return

  players.push(name)
  newPlayerNameInput.value = ''
  renderPlayersPool()
}


// ----------------------------------------
// lottery
// ----------------------------------------
function runLottery() {
  if (teams.length < 2) {
    alert('Add at least 2 teams before running the lottery.')
    return
  }

  if (players.length < teams.length * 2) {
    alert('You need at least 2 players per team (captain & vice).')
    return
  }

  var shuffledPlayers = shuffle(players.slice())
  var allocations = {}
  var assignedMap = {}
  var idx = 0

  teams.forEach(function (t) {
    var p1 = shuffledPlayers[idx++]
    var p2 = shuffledPlayers[idx++]
    allocations[t.id] = { captain: p1, vice: p2 }
    assignedMap[p1] = true
    assignedMap[p2] = true
  })

  currentAlloc = allocations
  renderTeamAllocations(allocations)
  renderPlayersPool(assignedMap)

  tableOrder = shuffle(teams.map(function (t) { return t.id }))
  initTableState(tableOrder)

  generateFixtures(allocations)
  if (knockoutWrap) knockoutWrap.innerHTML = ''
  if (knockoutFixtures) knockoutFixtures.innerHTML = ''
  knockoutInfo.textContent = ''
  fixtureNote.textContent = ''
}

function showChampionCelebration(winnerTeamId) {
  if (!champOverlay || !champTeamEl) return

  var team = teams.find(function (t) { return t.id === winnerTeamId })
  var name = team ? team.name : winnerTeamId

  champTeamEl.textContent = name
  champOverlay.classList.remove('hidden')

  // auto hide after 10 seconds
  setTimeout(function () {
    if (!champOverlay.classList.contains('hidden')) {
      champOverlay.classList.add('hidden')
    }
  }, 100000)
}


// ----------------------------------------
// fixtures & cards
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

  // simple fixture list on sidebar
  renderFixtureList(pairs)

  pairs.forEach(function (p, index) {
    var matchId = 'M' + (index + 1)
    matchState[matchId] = createEmptyMatch(p[0], p[1])
    var card = createFixtureCard(matchId, p[0], p[1], alloc)
    fixturesWrap.appendChild(card)
  })
}

function createFixtureCard(matchId, teamAId, teamBId, alloc) {
  var teamA = teams.find(function (t) { return t.id === teamAId })
  var teamB = teams.find(function (t) { return t.id === teamBId })

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
    '<div class="match-actions" style="display:flex;gap:.5rem;margin-top:.4rem;justify-content: center;">' +
      '<button class="mini-btn" data-role="finish" data-match="' + matchId + '"' +
        ' title="Save match"' +
        ' style="color:#22c55e;gap:2px;font-size:10px;display:flex;background:rgba(34,197,94,.12);border:1px solid #22c55e;flex-direction:column;align-items:center;">' +
        '<img src="save.png" alt="Save" style="width:20px;height:20px;vertical-align:middle;">Save</button>' +
      '<button class="mini-btn" data-role="undo" data-match="' + matchId + '"' +
        ' title="Undo last action"' +
        ' style="display:flex;color:#38bdf8;background:rgba(56,189,248,.08);font-size:10px;border:1px solid rgba(56,189,248,.3);flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="undo.png" alt="Undo" style="width:20px;height:20px;vertical-align:middle;">Undo</button>' +
      '<button class="mini-btn" data-role="reset" data-match="' + matchId + '"' +
        ' title="Reset match"' +
        ' style="display:flex;color:#f43f5e;background:rgba(244,63,94,.1);font-size:10px;border:1px solid rgba(244,63,94,.3);flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="reset.png" alt="Reset" style="width:20px;height:20px;vertical-align:middle;">Reset</button>' +
    '</div>'

  card.appendChild(head)
  card.appendChild(wrap)
  card.appendChild(btm)
  return card
}

function createInningsPanel(matchId, team, allocation, opponentTeam, opponentAlloc) {
  var captain = allocation && allocation.captain ? allocation.captain : 'Player 1'
  var vice    = allocation && allocation.vice    ? allocation.vice    : 'Player 2'

  var oppId   = opponentTeam.id
  var oppName = opponentTeam.name
  var oCap    = opponentAlloc && opponentAlloc.captain ? opponentAlloc.captain : 'Bowler 1'
  var oVice   = opponentAlloc && opponentAlloc.vice    ? opponentAlloc.vice    : 'Bowler 2'

  var panel = document.createElement('div')
  panel.className = 'score-panel'
  panel.innerHTML =
    '<p class="muted" style="margin:0 0 .3rem;font-size:.62rem;display:flex;gap:.35rem;align-items:center;">' +
      teamLogoHTML(team, 28) +
      '<span>'+team.name+' batting</span>' +
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

    '<div class="bowling-wrap" style="margin-top:.45rem;">' +
      '<h6 style="margin-bottom:.35rem;">Wickets by '+oppName+'</h6>' +
      '<div class="bowler-line">' +
        '<span>'+oCap+'</span>' +
        '<div>' +
          '<span class="muted" id="wb-'+matchId+'-'+oppId+'-p1">0</span>' +
          '<button class="mini-btn" data-role="add-wicket" data-match="'+matchId+'" data-team="'+oppId+'" data-bowler="p1">+1</button>' +
        '</div>' +
      '</div>' +
      '<div class="bowler-line">' +
        '<span>'+oVice+'</span>' +
        '<div>' +
          '<span class="muted" id="wb-'+matchId+'-'+oppId+'-p2">0</span>' +
          '<button class="mini-btn" data-role="add-wicket" data-match="'+matchId+'" data-team="'+oppId+'" data-bowler="p2">+1</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="bowling-actions" style="display:flex;gap:.45rem;justify-content:space-evenly;margin-top:.4rem;">' +
      '<button class="mini-btn" data-role="finish" data-match="'+matchId+'" title="Save match" ' +
        'style="color:#22c55e;gap:2px;font-size:10px;display:flex;background:rgba(34,197,94,.12);border:1px solid #22c55e;flex-direction:column;align-items:center;">' +
        '<img src="save.png" alt="Save" style="width:20px;height:20px;vertical-align:middle;">Save</button>' +
      '<button class="mini-btn" data-role="undo" data-match="'+matchId+'" title="Undo last action" ' +
        'style="display:flex;color:#38bdf8;background:rgba(56,189,248,.08);font-size:10px;border:1px solid rgba(56,189,248,.3);flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="undo.png" alt="Undo" style="width:20px;height:20px;vertical-align:middle;">Undo</button>' +
      '<button class="mini-btn" data-role="reset" data-match="'+matchId+'" title="Reset match" ' +
        'style="display:flex;color:#f43f5e;background:rgba(244,63,94,.1);font-size:10px;border:1px solid rgba(244,63,94,.3);flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="reset.png" alt="Reset" style="width:20px;height:20px;vertical-align:middle;">Reset</button>' +
    '</div>'

  return panel
}

function runBtnsHTML(matchId, teamId, playerSlot) {
  var runs = [0, 2, 4]
  return runs.map(function (r) {
    return '<button class="mini-btn" data-role="add-run" data-match="'+matchId+'" data-team="'+teamId+'" data-player="'+playerSlot+'" data-runs="'+r+'">'+r+'</button>'
  }).join('')
}


// ----------------------------------------
// click handling for BOTH league & knockout
// ----------------------------------------
function handleMatchClick(e, rootEl) {
  var el = e.target
  while (el && el !== rootEl && !el.dataset.role) {
    el = el.parentNode
  }
  if (!el || !el.dataset.role) return

  var role    = el.dataset.role
  var matchId = el.dataset.match
  if (!matchId) return

  if (role === 'add-extra') {
    addExtraRun(matchId, el.dataset.team)
  } else if (role === 'add-run') {
    addPlayerRun(matchId, el.dataset.team, el.dataset.player, parseInt(el.dataset.runs, 10))
  } else if (role === 'add-wicket') {
    addBowlerWicket(matchId, el.dataset.team, el.dataset.bowler)
  } else if (role === 'finish') {
    finishMatch(matchId)
  } else if (role === 'reset') {
    resetMatch(matchId)
  } else if (role === 'undo') {
    undoLastAction(matchId)
  }
}

fixturesWrap.addEventListener('click', function (e) {
  handleMatchClick(e, fixturesWrap)
})

if (knockoutWrap) {
  knockoutWrap.addEventListener('click', function (e) {
    handleMatchClick(e, knockoutWrap)
  })
}


// ----------------------------------------
// scoring helpers
// ----------------------------------------
function addExtraRun(matchId, teamId) {
  var m = matchState[matchId]
  if (!m) return
  m.innings[teamId].extras += 1
  m.history.push({ type: 'extra', teamId: teamId, amount: 1 })
  updateInningsUI(matchId, teamId)
}

function addPlayerRun(matchId, teamId, playerSlot, runs) {
  var m = matchState[matchId]
  if (!m) return
  var inn = m.innings[teamId]

  if (!inn.players[playerSlot]) {
    var nameEl = document.getElementById(playerSlot+'name-'+matchId+'-'+teamId)
    var nm = nameEl ? nameEl.textContent : playerSlot
    inn.players[playerSlot] = { name: nm, runs: 0 }
  }

  inn.players[playerSlot].runs += runs
  inn.runs += runs
  
  
  // 🔊 play sound only on 4
  if (runs === 4) {
    playSfx(sfxFour)
  }

  
  inn.balls += 1

  var overCompleted = false
  if (inn.balls % BALLS_PER_OVER === 0) {
    inn.overs += 1
    overCompleted = true
  }

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
  if (!m) return
  if (!m.bowling[bowlingTeamId]) {
    m.bowling[bowlingTeamId] = { p1:0, p2:0 }
  }
  m.bowling[bowlingTeamId][bowlerSlot] += 1
  
    // 🔊 wicket sound
  playSfx(sfxWicket)

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
  var m   = matchState[matchId]
  if (!m) return
  var inn = m.innings[teamId]

  document.getElementById('total-'+matchId+'-'+teamId).textContent  = inn.runs + inn.extras
  document.getElementById('extras-'+matchId+'-'+teamId).textContent = inn.extras
  document.getElementById('over-'+matchId+'-'+teamId).textContent   = oversToFloat(inn.overs, inn.balls).toFixed(1)

  var p1 = inn.players.p1 ? inn.players.p1.runs : 0
  var p2 = inn.players.p2 ? inn.players.p2.runs : 0
  document.getElementById('p1runs-'+matchId+'-'+teamId).textContent = p1 + ' runs'
  document.getElementById('p2runs-'+matchId+'-'+teamId).textContent = p2 + ' runs'
}

function resetMatch(matchId) {
  var m  = matchState[matchId]
  if (!m) return
  var t1 = m.teams[0]
  var t2 = m.teams[1]

  matchState[matchId] = createEmptyMatch(t1, t2)
  updateInningsUI(matchId, t1)
  updateInningsUI(matchId, t2)

  ;['p1','p2'].forEach(function (slot) {
    var s1 = document.getElementById('wb-'+matchId+'-'+t1+'-'+slot)
    var s2 = document.getElementById('wb-'+matchId+'-'+t2+'-'+slot)
    if (s1) s1.textContent = '0'
    if (s2) s2.textContent = '0'
  })

  var resultEl = document.getElementById('result-'+matchId)
  if (resultEl) resultEl.textContent = ''
  var momEl = document.getElementById('mom-'+matchId)
  if (momEl) momEl.value = ''
}


// ----------------------------------------
// finish match + leaderboards + knockout trigger
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
  m.result   = result

  // league table only for M* matches (not PO/FINAL)
  if (matchId.startsWith('M')) {
    if (result.tie) {
      tableState[t1].played += 1
      tableState[t2].played += 1
      tableState[t1].draw   += 1
      tableState[t2].draw   += 1
      tableState[t1].points += 1
      tableState[t2].points += 1
    } else {
      tableState[result.winner].played += 1
      tableState[result.loser].played  += 1
      tableState[result.winner].won    += 1
      tableState[result.loser].lost    += 1
      tableState[result.winner].points += 2
    }

    tableState[t1].runsFor     += t1Score
    tableState[t1].oversFaced  += t1Overs
    tableState[t1].runsAgainst += t2Score
    tableState[t1].oversBowled += t2Overs

    tableState[t2].runsFor     += t2Score
    tableState[t2].oversFaced  += t2Overs
    tableState[t2].runsAgainst += t1Score
    tableState[t2].oversBowled += t1Overs

    calcNRR()
    updatePointsTable()
  }

  // leaderboards (league + knockout)
  pushRunsToBoard(m, t1)
  pushRunsToBoard(m, t2)
  pushWicketsToBoard(matchId, m, t1)
  pushWicketsToBoard(matchId, m, t2)
  pushImpactToBoard(m, t1)
  pushImpactToBoard(m, t2)
  renderLeaderboards()
  renderPOTMBoard()

  var momName = pickManOfMatch(m)
  var momEl = document.getElementById('mom-' + matchId)
  if (momEl && momName) momEl.value = momName

  var resultEl = document.getElementById('result-' + matchId)
  if (resultEl) {
    if (result.tie) {
      resultEl.textContent = 'Result: Tie'
    } else {
      var winTeam = teams.find(function (x) { return x.id === result.winner })
      resultEl.textContent = 'Result: ' + (winTeam ? winTeam.name : result.winner) + ' ' + result.margin
    }
  }
  
    var resultEl = document.getElementById('result-' + matchId)
  if (resultEl) {
    if (result.tie) {
      resultEl.textContent = 'Result: Tie'
    } else {
      var winTeam = teams.find(function (x) { return x.id === result.winner })
      resultEl.textContent = 'Result: ' + (winTeam ? winTeam.name : result.winner) + ' ' + result.margin
    }
  }

  // connect playoff → final
  if (matchId === 'PO' && m.result && !m.result.tie) {
    buildFinalAfterPlayoff(m.result.winner)
  }

  // if final match completed with a winner → show fireworks
  if (matchId === 'FINAL' && !result.tie) {
    showChampionCelebration(result.winner)
	playSfx(sfxWin)
  }
}


function pickManOfMatch(m) {
  if (!m || !m.teams) return null
  var best = { name:null, score:-1, runs:0, wkts:0 }

  m.teams.forEach(function (tid) {
    var inn  = m.innings[tid]
    var bowl = m.bowling[tid]
    ;['p1','p2'].forEach(function (slot) {
      var name = (inn.players[slot] && inn.players[slot].name) || ('Player ' + slot)
      var runs = (inn.players[slot] && inn.players[slot].runs) || 0
      var wkts = (bowl && bowl[slot]) || 0
      var score = (runs / 4) + wkts
      if (score > best.score) {
        best = { name:name, score:score, runs:runs, wkts:wkts }
      }
    })
  })

  if (!best.name) return null
  return best.name + ' ('+best.runs+' runs, '+best.wkts+' wkts)'
}


// ----------------------------------------
// leaderboards
// ----------------------------------------
function pushRunsToBoard(matchObj, teamId) {
  var inn = matchObj.innings[teamId]
  if (!inn.players) return
  ;['p1','p2'].forEach(function (slot) {
    if (inn.players[slot]) {
      var name = inn.players[slot].name
      var runs = inn.players[slot].runs
      if (!runBoard[name]) runBoard[name] = 0
      runBoard[name] += runs
    }
  })
}

function guessBowlerName(matchId, teamId, slot) {
  var nameEl = document.getElementById(slot+'name-'+matchId+'-'+teamId)
  return nameEl ? nameEl.textContent : null
}

function pushWicketsToBoard(matchId, matchObj, teamId) {
  var bowl = matchObj.bowling[teamId]
  if (!bowl) return
  ;['p1','p2'].forEach(function (slot) {
    var taken = bowl[slot] || 0
    if (taken > 0) {
      var bowlerName = guessBowlerName(matchId, teamId, slot) || ('Player ' + slot)
      if (!wicketBoard[bowlerName]) wicketBoard[bowlerName] = 0
      wicketBoard[bowlerName] += taken
    }
  })
}

function pushImpactToBoard(matchObj, teamId) {
  var inn  = matchObj.innings[teamId]
  var bowl = matchObj.bowling[teamId]
  if (!inn || !inn.players) return

  ;['p1','p2'].forEach(function (slot) {
    var name = (inn.players[slot] && inn.players[slot].name) ? inn.players[slot].name : ('Player ' + slot)
    var runs = (inn.players[slot] && inn.players[slot].runs) ? inn.players[slot].runs : 0
    var wkts = (bowl && typeof bowl[slot] === 'number') ? bowl[slot] : 0
    var impact = (runs / 4) + wkts

    if (!potmBoard[name]) potmBoard[name] = 0
    potmBoard[name] += impact
  })
}

function renderLeaderboards() {
  var runArr = Object.keys(runBoard).map(function (name) {
    return { name:name, val:runBoard[name] }
  }).sort(function (a, b) { return b.val - a.val })

  runLeadersEl.innerHTML = ''
  if (runArr.length === 0) {
    runLeadersEl.innerHTML = '<p class="muted tiny">No data yet</p>'
  } else {
    runArr.slice(0,5).forEach(function (it) {
      var d = document.createElement('div')
      d.className = 'lb-item'
      d.innerHTML = '<span class="lb-name">'+it.name+'</span><span class="lb-val">'+it.val+'</span>'
      runLeadersEl.appendChild(d)
    })
  }

  var wArr = Object.keys(wicketBoard).map(function (name) {
    return { name:name, val:wicketBoard[name] }
  }).sort(function (a, b) { return b.val - a.val })

  wicketLeadersEl.innerHTML = ''
  if (wArr.length === 0) {
    wicketLeadersEl.innerHTML = '<p class="muted tiny">No data yet</p>'
  } else {
    wArr.slice(0,5).forEach(function (it) {
      var d2 = document.createElement('div')
      d2.className = 'lb-item'
      d2.innerHTML = '<span class="lb-name">'+it.name+'</span><span class="lb-val">'+it.val+'</span>'
      wicketLeadersEl.appendChild(d2)
    })
  }
}

function renderPOTMBoard() {
  if (!potmLeadersEl) return
  var arr = Object.keys(potmBoard).map(function (name) {
    return { name:name, val:potmBoard[name] }
  }).sort(function (a, b) { return b.val - a.val })

  potmLeadersEl.innerHTML = ''
  if (arr.length === 0) {
    potmLeadersEl.innerHTML = '<p class="muted tiny">No data yet</p>'
    return
  }

  arr.slice(0,3).forEach(function (it) {
    var d = document.createElement('div')
    d.className = 'lb-item'
    d.innerHTML =
      '<span class="lb-name">'+it.name+'</span>' +
      '<span class="lb-val">'+it.val.toFixed(1)+'</span>'
    potmLeadersEl.appendChild(d)
  })
}


// ----------------------------------------
// table & knockout
// ----------------------------------------
function calcNRR() {
  Object.keys(tableState).forEach(function (k) {
    var t = tableState[k]
    var forRate = t.oversFaced   > 0 ? (t.runsFor     / t.oversFaced)   : 0
    var agRate  = t.oversBowled  > 0 ? (t.runsAgainst / t.oversBowled)  : 0
    t.nrr = forRate - agRate
  })
}

function updatePointsTable() {
  var arr = Object.keys(tableState).map(function (k) { return tableState[k] })

  arr.sort(function (a, b) {
    if (b.points !== a.points) return b.points - a.points
    return b.nrr - a.nrr
  })

  pointsTableBody.innerHTML = ''
  arr.forEach(function (t, i) {
    var meta = teams.find(function (x) { return x.id === t.teamId })
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

  // need at least 3 teams to do 1st→Final and 2nd vs 3rd playoff
  if (arr.length < 3) {
    knockoutInfo.textContent = ''
    if (knockoutFixtures) knockoutFixtures.innerHTML = ''
    if (knockoutWrap) knockoutWrap.innerHTML = ''
    return
  }

  // only show knockout AFTER all league matches M* finished
  var leagueMatchIds = Object.keys(matchState).filter(function (id) {
    return id.startsWith('M')
  })
  if (leagueMatchIds.length === 0) {
    knockoutInfo.textContent = ''
    if (knockoutFixtures) knockoutFixtures.innerHTML = ''
    if (knockoutWrap) knockoutWrap.innerHTML = ''
    return
  }

  var finishedLeagueMatches = leagueMatchIds.filter(function (id) {
    return matchState[id] && matchState[id].finished
  }).length

  if (finishedLeagueMatches < leagueMatchIds.length) {
    knockoutInfo.textContent = ''
    if (knockoutFixtures) knockoutFixtures.innerHTML = ''
    if (knockoutWrap) knockoutWrap.innerHTML = ''
    return
  }

  // league done → top 3
  var first  = arr[0]
  var second = arr[1]
  var third  = arr[2]

  var firstMeta  = teams.find(function (t) { return t.id === first.teamId })
  var secondMeta = teams.find(function (t) { return t.id === second.teamId })
  var thirdMeta  = teams.find(function (t) { return t.id === third.teamId })

  var firstName  = firstMeta  ? firstMeta.name  : first.teamId
  var secondName = secondMeta ? secondMeta.name : second.teamId
  var thirdName  = thirdMeta  ? thirdMeta.name  : third.teamId

  knockoutInfo.textContent = firstName + ' to Final. ' + secondName + ' vs ' + thirdName + ' playoff.'

  renderKnockoutFixtures(first, second, third)
  buildKnockoutMatchCards(first.teamId, second.teamId, third.teamId)
}

function renderKnockoutFixtures(first, second, third) {
  if (!knockoutFixtures) return

  var firstTeam  = teams.find(function (t) { return t.id === first.teamId })
  var secondTeam = teams.find(function (t) { return t.id === second.teamId })
  var thirdTeam  = teams.find(function (t) { return t.id === third.teamId })

  knockoutFixtures.innerHTML =
    '<div class="fixture-card" style="margin-top:.35rem;padding:.4rem .5rem;">' +
      '<p class="muted" style="margin:0 0 .25rem;">Playoff</p>' +
      '<strong>' + (secondTeam ? secondTeam.name : second.teamId) + '</strong> vs ' +
      '<strong>' + (thirdTeam  ? thirdTeam.name  : third.teamId ) + '</strong>' +
      '<p class="muted" style="margin:.25rem 0 0;font-size:.6rem;">Winner → Final</p>' +
    '</div>' +
    '<div class="fixture-card" style="margin-top:.35rem;padding:.4rem .5rem;">' +
      '<p class="muted" style="margin:0 0 .25rem;">Final</p>' +
      '<strong>' + (firstTeam ? firstTeam.name : first.teamId) + '</strong> vs <strong>Winner of Playoff</strong>' +
      '<p class="muted" style="margin:.25rem 0 0;font-size:.6rem;">Auto-updates when playoff finishes</p>' +
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

  matchState['PO']    = createEmptyMatch(secondId, thirdId)
  matchState['FINAL'] = createEmptyMatch(firstId, firstId)
}

function createKnockoutFixtureCard(matchId, teamAId, teamBId) {
  var alloc = currentAlloc || {}
  var card = document.createElement('div')
  card.className = 'fixture-card'
  card.id = 'card-' + matchId

  var teamA = teams.find(function (t) { return t.id === teamAId })
  var teamB = teamBId ? teams.find(function (t) { return t.id === teamBId }) : null

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
    '<div class="match-actions" style="display:flex;gap:.5rem;margin-top:.4rem;justify-content: center;">' +
      '<button class="mini-btn" data-role="finish" data-match="' + matchId + '"' +
        ' title="Save match"' +
        ' style="color:#22c55e;gap:2px;font-size:10px;display:flex;background:rgba(34,197,94,.12);border:1px solid #22c55e;flex-direction:column;align-items:center;">' +
        '<img src="save.png" alt="Save" style="width:20px;height:20px;vertical-align:middle;">Save</button>' +
      '<button class="mini-btn" data-role="undo" data-match="' + matchId + '"' +
        ' title="Undo last action"' +
        ' style="display:flex;color:#38bdf8;background:rgba(56,189,248,.08);font-size:10px;border:1px solid rgba(56,189,248,.3);flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="undo.png" alt="Undo" style="width:20px;height:20px;vertical-align:middle;">Undo</button>' +
      '<button class="mini-btn" data-role="reset" data-match="' + matchId + '"' +
        ' title="Reset match"' +
        ' style="display:flex;color:#f43f5e;background:rgba(244,63,94,.1);font-size:10px;border:1px solid rgba(244,63,94,.3);flex-direction:column;align-items:center;gap:2px;">' +
        '<img src="reset.png" alt="Reset" style="width:20px;height:20px;vertical-align:middle;">Reset</button>' +
    '</div>'

  card.appendChild(head)
  card.appendChild(wrap)
  card.appendChild(btm)
  return card
}

function buildFinalAfterPlayoff(playoffWinnerId) {
  if (!knockoutWrap || !currentFinalHost) return
  var oldFinal = document.getElementById('card-FINAL')
  if (oldFinal) oldFinal.remove()
  var finalCard = createKnockoutFixtureCard('FINAL', currentFinalHost, playoffWinnerId)
  knockoutWrap.appendChild(finalCard)
  matchState['FINAL'] = createEmptyMatch(currentFinalHost, playoffWinnerId)
}


// ----------------------------------------
// undo
// ----------------------------------------
function undoLastAction(matchId) {
  var m = matchState[matchId]
  if (!m || !m.history || m.history.length === 0) return

  var last = m.history.pop()

  if (last.type === 'extra') {
    var inn = m.innings[last.teamId]
    inn.extras = Math.max(0, inn.extras - last.amount)
    updateInningsUI(matchId, last.teamId)
  } else if (last.type === 'run') {
    var inn2 = m.innings[last.teamId]
    inn2.runs = Math.max(0, inn2.runs - last.runs)
    if (inn2.players[last.playerSlot]) {
      inn2.players[last.playerSlot].runs = Math.max(0, inn2.players[last.playerSlot].runs - last.runs)
    }
    if (inn2.balls > 0) {
      inn2.balls -= 1
    }
    if (last.overCompleted && inn2.overs > 0) {
      inn2.overs -= 1
    }
    updateInningsUI(matchId, last.teamId)
  } else if (last.type === 'wicket') {
    var bw = m.bowling[last.bowlingTeamId]
    if (bw && bw[last.bowlerSlot] > 0) {
      bw[last.bowlerSlot] -= 1
    }
    var span = document.getElementById('wb-'+matchId+'-'+last.bowlingTeamId+'-'+last.bowlerSlot)
    if (span) span.textContent = bw[last.bowlerSlot]
  }
}


// ----------------------------------------
// init
// ----------------------------------------
renderTeamsBar()
renderPlayersPool()
initTableState(tableOrder)
renderLeaderboards()
renderPOTMBoard()

var runLotteryBtn = document.getElementById('runLotteryBtn')
if (runLotteryBtn) {
  runLotteryBtn.addEventListener('click', runLottery)
}

if (closeChampBtn && champOverlay) {
  closeChampBtn.addEventListener('click', function () {
    champOverlay.classList.add('hidden')
  })
}

if (addTeamBtn) {
  addTeamBtn.addEventListener('click', addTeamFromInput)
  newTeamNameInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addTeamFromInput()
  })
}
if (addPlayerBtn) {
  addPlayerBtn.addEventListener('click', addPlayerFromInput)
  newPlayerNameInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addPlayerFromInput()
  })
}

window.addEventListener('beforeunload', function (e) {
  if (Object.keys(matchState).length > 0) {
    var message = 'Your current match data will be lost if you reload or leave this page.'
    e.preventDefault()
    e.returnValue = message
    return message
  }
})
