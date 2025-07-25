const files = [
  'fighters.json', 'archetypes.json', 'primaryWeapons.json',
  'secondaryWeapons.json', 'mounts.json', 'divineBlessings.json',
  'extraRunemarks.json', 'rules.json'
];

const data = {};
let rules = {};

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
  document.querySelectorAll('select, input').forEach(el => el.addEventListener('change', updateSummary));
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

function validateBuild(runemarks, profiles, fighter, archetype, mount) {
  const messages = [];

  // Archetype restrictions
  if (archetype) {
    if (archetype.restrictions.forbiddenFighters.includes(fighter.name)) {
      messages.push(`${archetype.name} cannot be taken by ${fighter.name}.`);
    }
    if (archetype.restrictions.forbiddenFactions.some(f => fighter.factionRunemarks.includes(f))) {
      messages.push(`${archetype.name} cannot be taken by fighters from ${archetype.restrictions.forbiddenFactions.join(', ')}.`);
    }
  }

  // Mount restrictions
  if (mount && mount.name !== 'None') {
    if (mount.restrictions.forbiddenFighters.includes(fighter.name)) {
      messages.push(`${mount.name} cannot be taken by ${fighter.name}.`);
    }
  }

  // Runemark cap (excluding faction runemark)
  if (runemarks.length > rules.maxRunemarks) {
    messages.push(`Too many runemarks (max ${rules.maxRunemarks}, excluding faction).`);
  }

  // Attack action cap
  if (profiles.length > rules.maxAttackActions) {
    messages.push(`Too many attack profiles (max ${rules.maxAttackActions}).`);
  }

  // Secondary weapon restrictions
  const primary = data.primaryWeapons.find(w => w.name === document.getElementById('primarySelect').value);
  const secondary = document.getElementById('secondarySelect').value;
  if (secondary !== 'None' && primary.handedness !== 'one') {
    messages.push(`Secondary weapon only allowed with one-handed primary weapons.`);
  }

  document.getElementById('validationMessages').innerHTML = messages.join('<br>');
  return messages.length === 0;
}

function buildProfiles(stats, fighter, primary, secondary, archetype) {
  const profiles = [];

  // Base melee profile (with reach)
  let meleeProfile = {
    type: 'Melee',
    range: [fighter.R + (primary.modifiers?.rangeBonus || 0), fighter.R + (primary.modifiers?.rangeBonus || 0)],
    attacks: stats.A,
    strength: stats.S,
    damage: stats.D,
    crit: stats.C
  };

  // Handle unarmed or replaced melee
  if (primary.notes.includes('Fighter counts as unarmed in melee')) {
    meleeProfile.attacks = Math.max(meleeProfile.attacks + rules.unarmedPenalties.attackPenalty, rules.unarmedPenalties.minimumValues.attacks);
    meleeProfile.damage = Math.max(meleeProfile.damage + rules.unarmedPenalties.damagePenalty, rules.unarmedPenalties.minimumValues.damage);
    meleeProfile.crit = Math.max(meleeProfile.crit + rules.unarmedPenalties.critPenalty, rules.unarmedPenalties.minimumValues.crit);
  }
  if (primary.notes.includes('Replaces melee profile entirely')) {
    meleeProfile = null;
  }
  if (meleeProfile) profiles.push(meleeProfile);

  // Add ranged profiles from weapons
  if (primary.addsRangedProfile) {
    profiles.push(resolveRangedProfile(primary.addsRangedProfile, stats, primary.modifiers));
  }
  if (secondary && secondary.addsRangedProfile) {
    profiles.push(resolveRangedProfile(secondary.addsRangedProfile, stats, secondary.modifiers));
  }

  // Archetype special attacks (Mage)
  if (archetype && archetype.attackProfile) {
    profiles.push(resolveRangedProfile(archetype.attackProfile, stats));
  }

  return profiles;
}

function resolveRangedProfile(profile, stats, modifiers = {}) {
  const p = { ...profile, type: 'Ranged' };
  
  // Handle base stat substitutions
  if (p.strength === 'baseStrength') {
    p.strength = stats.S;
  }
  if (p.attacks === 'baseAttacks') {
    p.attacks = stats.A;
  }
  if (p.damage === 'baseDamage') {
    p.damage = stats.D;
  }
  if (p.crit === 'baseCrit') {
    p.crit = stats.C;
  }
  
  // Apply weapon modifiers to the profile
  if (modifiers.attackBonus) p.attacks += modifiers.attackBonus;
  if (modifiers.strengthBonus) p.strength += modifiers.strengthBonus;
  if (modifiers.damageBonus) p.damage += modifiers.damageBonus;
  if (modifiers.critBonus) p.crit += modifiers.critBonus;
  
  return p;
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

  let stats = { Mv: fighter.Mv, T: fighter.T, W: fighter.W, S: fighter.S, A: fighter.A, D: fighter.D, C: fighter.C };
  let runemarks = [...fighter.runemarks];
  let factionRunemark = faction;

  // Archetype runemarks & effects
  if (archetype) {
    if (archetype.effects.includes('gain runemark: Mystic')) runemarks.push('Mystic');
    if (archetype.effects.includes('gain runemark: Priest')) runemarks.push('Priest');
    if (archetype.effects.some(e => e.includes('-1 melee attack'))) {
      stats.A = Math.max(stats.A - 1, 1);
    }
  }

  // Mount
  if (mount && mount.name !== 'None') {
    stats.Mv += mount.modifiers.movementBonus;
    stats.W += mount.modifiers.woundsBonus;
    stats.A += mount.modifiers.attackBonus;
    stats.T += mount.modifiers.toughnessBonus;
    if (fighter.name !== 'Malignant') runemarks.push(...mount.runemarksAdded);
    if (mount.restrictions.maxMovement) {
      stats.Mv = Math.min(stats.Mv, mount.restrictions.maxMovement);
    }
  }

  // Blessing
  let blessingEffectText = 'None';
  if (blessing && blessing.name !== 'None') {
    blessingEffectText = blessing.effect.special || JSON.stringify(blessing.effect);
    const e = blessing.effect;
    if (e.movementBonus) stats.Mv += e.movementBonus;
    if (e.toughnessBonus) stats.T += e.toughnessBonus;
    if (e.woundsBonus) stats.W += e.woundsBonus;
    if (e.attackBonus) stats.A += e.attackBonus;
    if (e.strengthBonus) stats.S += e.strengthBonus;
    if (e.damageBonus) stats.D += e.damageBonus;
    if (e.critBonus) stats.C += e.critBonus;
  }

  // Extra runemark
  if (extraRunemark && extraRunemark.name !== 'None') {
    runemarks.push(extraRunemark.name);
  }

  // Primary/secondary mods
  if (primary.modifiers) {
    stats.A += (primary.modifiers.attackBonus || 0);
    stats.S += (primary.modifiers.strengthBonus || 0);
    stats.D += (primary.modifiers.damageBonus || 0);
    stats.C += (primary.modifiers.critBonus || 0);
  }
  if (secondary && secondary.name !== 'None') {
    stats.T += (secondary.modifiers.toughnessBonus || 0);
    stats.A += (secondary.modifiers.attackBonus || 0);
  }

  // Build profiles
  const profiles = buildProfiles(stats, fighter, primary, secondary, archetype);

  // Validate
  validateBuild(runemarks, profiles, fighter, archetype, mount);

  // Points calculation
  let totalPoints = fighter.points + (archetype?.points || 0) + (primary?.points || 0);
  if (secondary && secondary.name !== 'None') totalPoints += secondary.points;
  if (mount && mount.name !== 'None') totalPoints += mount.points;
  if (blessing && blessing.name !== 'None') {
    totalPoints += stats.W >= 23 ? blessing.pointsHigh : blessing.pointsLow;
  }
  if (extraRunemark && extraRunemark.name !== 'None') totalPoints += extraRunemark.points;

  // Display - Updated to remove S, A, D stats and only show Mv, T, W
  document.getElementById('fighterType').textContent = fighter.name;
  document.getElementById('fighterName').textContent = document.getElementById('fighterNameInput').value || 'Unnamed';
  document.getElementById('runemarkDisplay').textContent = runemarks.join(', ') || '-';
  document.getElementById('factionRunemarkDisplay').textContent = factionRunemark || '-';
  document.getElementById('statMv').textContent = stats.Mv;
  document.getElementById('statT').textContent = stats.T;
  document.getElementById('statW').textContent = stats.W;
  document.getElementById('blessingEffect').textContent = blessingEffectText;
  document.getElementById('pointsTotal').textContent = totalPoints;

  const attackList = profiles.map(p => {
    let rangeText;
    if (p.type === 'Melee') {
      rangeText = Array.isArray(p.range) ? p.range[0] : p.range;
    } else {
      rangeText = Array.isArray(p.range) ? p.range.join('-') : p.range;
    }
    return `<li>${p.type}: Range ${rangeText}, Attacks ${p.attacks}, Strength ${p.strength}, Damage ${p.damage}/${p.crit}</li>`;
  }).join('');
  document.getElementById('attackProfiles').innerHTML = attackList;
}

function saveBuild() {
  const selections = {};
  ['fighter', 'faction', 'archetype', 'primary', 'secondary', 'mount', 'blessing', 'runemark'].forEach(key => {
    selections[key] = document.getElementById(`${key}Select`).value;
  });
  selections.fighterName = document.getElementById('fighterNameInput').value || '';
  localStorage.setItem('warcryBuild', JSON.stringify(selections));

  // Save as text export format
  const text = exportTextSummary();
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fighter_build.txt';
  a.click();
}

function loadBuildFromFile() {
  const fileInput = document.getElementById('loadFileInput');
  fileInput.click();
  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const lines = evt.target.result.split('\n');
      if (!lines[0].includes('Warcry Fighter Build')) {
        alert('Invalid build file format.');
        return;
      }
      parseAndApplyBuild(lines);
    };
    reader.readAsText(file);
  };
}

function parseAndApplyBuild(lines) {
  const map = {};
  lines.forEach(line => {
    const [key, val] = line.split(':').map(s => s.trim());
    if (key && val !== undefined) map[key] = val;
  });
  const fields = {
    'Fighter': 'fighterSelect',
    'Faction': 'factionSelect',
    'Archetype': 'archetypeSelect',
    'Primary': 'primarySelect',
    'Secondary': 'secondarySelect',
    'Mount': 'mountSelect',
    'Blessing': 'blessingSelect',
    'Extra Runemark': 'runemarkSelect'
  };
  for (const [label, id] of Object.entries(fields)) {
    if (map[label]) document.getElementById(id).value = map[label];
  }
  if (map['Fighter Name']) document.getElementById('fighterNameInput').value = map['Fighter Name'];
  updateSummary();
}

function exportTextSummary() {
  return `Warcry Fighter Build
Fighter: ${document.getElementById('fighterSelect').value}
Fighter Name: ${document.getElementById('fighterNameInput').value || 'Unnamed'}
Faction: ${document.getElementById('factionSelect').value}
Archetype: ${document.getElementById('archetypeSelect').value}
Primary: ${document.getElementById('primarySelect').value}
Secondary: ${document.getElementById('secondarySelect').value}
Mount: ${document.getElementById('mountSelect').value}
Blessing: ${document.getElementById('blessingSelect').value}
Extra Runemark: ${document.getElementById('runemarkSelect').value}
Total Points: ${document.getElementById('pointsTotal').textContent}`;
}

function exportBuildPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  const content = document.getElementById('statsDisplay').innerText;
  pdf.setFontSize(12);
  pdf.text(content, 10, 10);
  pdf.save('fighter_build.pdf');
}

init();
