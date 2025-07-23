const files = [
  'fighters.json', 'archetypes.json', 'primaryWeapons.json',
  'secondaryWeapons.json', 'mounts.json', 'divineBlessings.json',
  'extraRunemarks.json', 'rules.json'
];

const data = {};
let rules = {};
let currentBuild = {};

async function init() {
  for (const file of files) {
    const res = await fetch(`data/${file}`);
    data[file.replace('.json', '')] = await res.json();
  }
  rules = data.rules;
  populateSelections();
}

function populateSelections() {
  fillSelect('fighterSelect', data.fighters.map(f => f.name));
  fillSelect('archetypeSelect', data.archetypes.map(a => a.name));
  fillSelect('primarySelect', data.primaryWeapons.map(w => w.name));
  fillSelect('secondarySelect', ['None'].concat(data.secondaryWeapons.map(w => w.name)));
  fillSelect('mountSelect', ['None'].concat(data.mounts.map(m => m.name)));
  fillSelect('blessingSelect', ['None'].concat(data.divineBlessings.map(b => b.name)));
  fillSelect('runemarkSelect', ['None'].concat(data.extraRunemarks.map(r => r.name)));

  document.getElementById('fighterSelect').addEventListener('change', updateFactionOptions);
  document.querySelectorAll('select').forEach(sel => sel.addEventListener('change', updateSummary));
  updateFactionOptions();
}

function fillSelect(id, options) {
  const sel = document.getElementById(id);
  sel.innerHTML = options.map(o => `<option>${o}</option>`).join('');
}

function updateFactionOptions() {
  const fighterName = document.getElementById('fighterSelect').value;
  const fighter = data.fighters.find(f => f.name === fighterName);
  fillSelect('factionSelect', fighter.factionRunemarks);
  updateSummary();
}

function validateBuild(stats, runemarks, profiles) {
  const messages = [];

  if (runemarks.length > rules.maxRunemarks) {
    messages.push(`Too many runemarks (max ${rules.maxRunemarks}).`);
  }

  const attackActions = profiles.length;
  if (attackActions > rules.maxAttackActions) {
    messages.push(`Too many attack profiles (max ${rules.maxAttackActions}).`);
  }

  const primary = data.primaryWeapons.find(w => w.name === document.getElementById('primarySelect').value);
  const secondary = document.getElementById('secondarySelect').value;
  if (secondary !== 'None' && primary.handedness !== 'one') {
    messages.push(`Secondary weapon only allowed with one-handed primary weapons.`);
  }

  document.getElementById('validationMessages').innerHTML = messages.join('<br>');
  return messages.length === 0;
}

function updateSummary() {
  const fighter = data.fighters.find(f => f.name === document.getElementById('fighterSelect').value);
  const faction = document.getElementById('factionSelect').value;
  const archetype = data.archetypes.find(a => a.name === document.getElementById('archetypeSelect').value);
  const primary = data.primaryWeapons.find(w => w.name === document.getElementById('primarySelect').value);
  const secondary = data.secondaryWeapons.find(w => w.name === document.getElementById('secondarySelect').value) || null;
  const mount = data.mounts.find(m => m.name === document.getElementById('mountSelect').value) || null;
  const blessing = data.divineBlessings.find(b => b.name === document.getElementById('blessingSelect').value) || null;
  const extraRunemark = data.extraRunemarks.find(r => r.name === document.getElementById('runemarkSelect').value) || null;

  let stats = { Mv: fighter.Mv, T: fighter.T, W: fighter.W, A: fighter.A, S: fighter.S, D: fighter.D, C: fighter.C };
  let runemarks = [...fighter.runemarks, faction];
  let profiles = [];

  // Mount mods
  if (mount) {
    stats.Mv += mount.modifiers.movementBonus;
    stats.W += mount.modifiers.woundsBonus;
    stats.A += mount.modifiers.attackBonus;
    stats.T += mount.modifiers.toughnessBonus;
    if (!(fighter.name === 'Malignant')) runemarks.push(...mount.runemarksAdded);
  }

  // Blessing mods
  if (blessing) {
    const e = blessing.effect;
    if (e.movementBonus) stats.Mv += e.movementBonus;
    if (e.toughnessBonus) stats.T += e.toughnessBonus;
    if (e.woundsBonus) stats.W += e.woundsBonus;
    if (e.attackBonus) stats.A += e.attackBonus;
    if (e.strengthBonus) stats.S += e.strengthBonus;
    if (e.damageBonus) stats.D += e.damageBonus;
    if (e.critBonus) stats.C += e.critBonus;
  }

  // Primary weapon mods
  if (primary.modifiers) {
    stats.A += (primary.modifiers.attackBonus || 0);
    stats.S += (primary.modifiers.strengthBonus || 0);
    stats.D += (primary.modifiers.damageBonus || 0);
    stats.C += (primary.modifiers.critBonus || 0);
  }

  // Secondary weapon mods
  if (secondary && secondary.name !== 'None') {
    stats.T += (secondary.modifiers.toughnessBonus || 0);
    stats.A += (secondary.modifiers.attackBonus || 0);
  }

  // Handle unarmed/replaced profiles
  let meleeProfile = { type: 'Melee', attacks: stats.A, strength: stats.S, damage: stats.D, crit: stats.C };
  if (primary.notes.includes('Fighter counts as unarmed in melee')) {
    meleeProfile.attacks = Math.max(stats.A + rules.unarmedPenalties.attackPenalty, rules.unarmedPenalties.minimumValues.attacks);
    meleeProfile.damage = Math.max(stats.D + rules.unarmedPenalties.damagePenalty, rules.unarmedPenalties.minimumValues.damage);
    meleeProfile.crit = Math.max(stats.C + rules.unarmedPenalties.critPenalty, rules.unarmedPenalties.minimumValues.crit);
  }
  if (primary.notes.includes('Replaces melee profile entirely')) {
    meleeProfile = null; // Only ranged
  }
  if (meleeProfile) profiles.push(meleeProfile);

  // Add ranged profiles from weapons
  if (primary.addsRangedProfile) {
    profiles.push({ type: 'Ranged', ...primary.addsRangedProfile });
  }
  if (secondary && secondary.addsRangedProfile) {
    profiles.push({ type: 'Ranged', ...secondary.addsRangedProfile });
  }

  // Validate
  validateBuild(stats, runemarks, profiles);

  // Calculate points
  let totalPoints = fighter.points + (archetype?.points || 0) + (primary?.points || 0);
  if (secondary && secondary.name !== 'None') totalPoints += secondary.points;
  if (mount && mount.name !== 'None') totalPoints += mount.points;
  if (blessing && blessing.name !== 'None') totalPoints += stats.W >= 23 ? blessing.pointsHigh : blessing.pointsLow;
  if (extraRunemark && extraRunemark.name !== 'None') totalPoints += extraRunemark.points;

  // Display
  document.getElementById('fighterName').textContent = fighter.name;
  document.getElementById('runemarkDisplay').textContent = runemarks.join(', ');
  document.getElementById('statMv').textContent = stats.Mv;
  document.getElementById('statT').textContent = stats.T;
  document.getElementById('statW').textContent = stats.W;
  document.getElementById('statA').textContent = stats.A;
  document.getElementById('statS').textContent = stats.S;
  document.getElementById('statDC').textContent = `${stats.D}/${stats.C}`;
  document.getElementById('pointsTotal').textContent = totalPoints;

  const attackList = profiles.map(p => 
    `<li>${p.type}: ${p.attacks || '-'} Attacks, Range ${p.range ? p.range.join('-') : 'Melee'}, S${p.strength}, ${p.damage}/${p.crit}</li>`
  ).join('');
  document.getElementById('attackProfiles').innerHTML = attackList;
}

function saveBuild() {
  const selections = {};
  ['fighter', 'faction', 'archetype', 'primary', 'secondary', 'mount', 'blessing', 'runemark']
    .forEach(key => selections[key] = document.getElementById(`${key}Select`).value);
  localStorage.setItem('warcryBuild', JSON.stringify(selections));
  alert('Build saved!');
}

function loadBuild() {
  const build = JSON.parse(localStorage.getItem('warcryBuild') || '{}');
  for (const [key, value] of Object.entries(build)) {
    const sel = document.getElementById(`${key}Select`);
    if (sel) sel.value = value;
  }
  updateSummary();
}

function exportBuild() {
  const text = `Warcry Fighter Build
Fighter: ${document.getElementById('fighterSelect').value}
Faction: ${document.getElementById('factionSelect').value}
Archetype: ${document.getElementById('archetypeSelect').value}
Primary: ${document.getElementById('primarySelect').value}
Secondary: ${document.getElementById('secondarySelect').value}
Mount: ${document.getElementById('mountSelect').value}
Blessing: ${document.getElementById('blessingSelect').value}
Extra Runemark: ${document.getElementById('runemarkSelect').value}
Total Points: ${document.getElementById('pointsTotal').textContent}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fighter_build.txt';
  a.click();
}

init();
