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
  // Initial call to updateSummary after data is loaded and selections are populated
  updateSummary();
}

function populateSelections() {
  fillSelect('fighterSelect', data.fighters.map(f => f.name));
  fillSelect('archetypeSelect', data.archetypes.map(a => a.name));
  document.getElementById('archetypeSelect').value = 'Commander'; // Default to Commander

  fillSelect('mountSelect', ['None'].concat(data.mounts.map(m => m.name)));
  fillSelect('runemarkSelect', ['None'].concat(data.extraRunemarks.map(r => r.name)));

  const primaryWeaponOptions = data.primaryWeapons.map(w => `${w.name} (${w.handedness.charAt(0).toUpperCase() + w.handedness.slice(1)}-handed)`);
  fillSelect('primarySelect', primaryWeaponOptions);

  fillSelect('secondarySelect', ['None'].concat(data.secondaryWeapons.map(w => w.name)));
  fillSelect('blessingSelect', ['None'].concat(data.divineBlessings.map(b => b.name)));


  document.getElementById('fighterSelect').addEventListener('change', updateFactionOptions);
  document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', updateSummary);
  });
  document.getElementById('fighterNameInput').addEventListener('input', updateSummary);

  updateFactionOptions(); // Set initial faction options based on default fighter
}

function fillSelect(selectId, options) {
  const select = document.getElementById(selectId);
  select.innerHTML = '';
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

function updateFactionOptions() {
  const fighterSelect = document.getElementById('fighterSelect');
  const selectedFighterName = fighterSelect.value;
  const fighter = data.fighters.find(f => f.name === selectedFighterName);

  const factionSelect = document.getElementById('factionSelect');
  // Clear existing options
  factionSelect.innerHTML = '';

  if (fighter && fighter.factionRunemarks && fighter.factionRunemarks.length > 0) {
    fighter.factionRunemarks.forEach(runemark => {
      const option = document.createElement('option');
      option.value = runemark;
      option.textContent = runemark;
      factionSelect.appendChild(option);
    });
    factionSelect.style.display = 'block';
    factionSelect.previousElementSibling.style.display = 'block'; // Show label
  } else {
    // Hide if no faction runemarks
    factionSelect.style.display = 'none';
    factionSelect.previousElementSibling.style.display = 'none'; // Hide label
  }
  updateSummary();
}

// Helper to apply effects that modify basic fighter stats
function applyFighterEffects(fighterStats, effects) {
  if (!effects) return;
  for (const key in effects) {
    if (key.endsWith('Bonus')) {
      const statName = key.replace('Bonus', '');
      fighterStats[statName] = (fighterStats[statName] || 0) + effects[key];
    } else if (key.endsWith('Min')) {
      const statName = key.replace('Min', '');
      if (fighterStats[statName] < effects[key]) {
        fighterStats[statName] = effects[key];
      }
    } else if (key === 'unarmedInMelee' && effects[key]) {
      // Handled by primaryWeaponRequiresUnarmed logic
    }
  }
}

// Helper to calculate weapon profile after applying modifications
function calculateWeaponProfile(baseProfile, fighterStats, effects) {
  if (!baseProfile) return null;

  const profile = { ...baseProfile
  };

  // Replace base stats with fighter's actual stats
  if (profile.attacks === 'baseAttacks') profile.attacks = fighterStats.A;
  if (profile.strength === 'baseStrength') profile.strength = fighterStats.S;
  if (profile.damage === 'baseDamage') profile.damage = fighterStats.D;
  if (profile.crit === 'baseCrit') profile.crit = fighterStats.C;
  if (profile.range && profile.range[1] === 'baseReach') profile.range[1] = fighterStats.R;


  // Apply weapon-specific effects (from primary/secondary weapon's 'effects' field)
  if (effects) {
    applyFighterEffects(profile, effects); // Reusing applyFighterEffects as it handles bonuses
  }

  // Ensure minimums are met
  if (rules.unarmedPenalties && rules.unarmedPenalties.minimumValues) {
    const minValues = rules.unarmedPenalties.minimumValues;
    if (profile.attacks < minValues.attacks) profile.attacks = minValues.attacks;
    if (profile.damage < minValues.damage) profile.damage = minValues.damage;
    if (profile.crit < minValues.crit) profile.crit = minValues.crit;
  }

  return profile;
}

function getPrimaryWeaponNameFromDisplay(displayString) {
  const match = displayString.match(/(.*) \((One|Two)-handed\)/);
  return match ? match[1] : displayString;
}

function updateSummary() {
  const fighterNameInput = document.getElementById('fighterNameInput');
  const fighterName = fighterNameInput.value || 'Unnamed Fighter';
  document.getElementById('fighterName').textContent = fighterName;

  const selectedFighterName = document.getElementById('fighterSelect').value;
  const fighter = data.fighters.find(f => f.name === selectedFighterName);
  document.getElementById('fighterType').textContent = fighter ? fighter.name : 'N/A';

  const selectedFactionRunemark = document.getElementById('factionSelect').value;
  document.getElementById('factionRunemarkDisplay').textContent = selectedFactionRunemark || 'None';

  const currentFighterStats = { ...fighter
  }; // Copy base stats to apply modifiers
  let totalPoints = fighter ? fighter.points : 0;
  let validationMessages = [];
  let fighterAttackProfiles = [];
  let currentRunemarks = new Set(fighter ? fighter.runemarks : []);
  let primaryWeaponRequiresUnarmed = false;

  // --- Archetype ---
  const selectedArchetypeName = document.getElementById('archetypeSelect').value;
  const archetype = data.archetypes.find(a => a.name === selectedArchetypeName);

  if (archetype) {
    totalPoints += archetype.points;

    // Apply fighter effects from archetype
    applyFighterEffects(currentFighterStats, archetype.fighterEffects);

    // Add runemarks from archetype
    if (archetype.runemarksAdded) {
      archetype.runemarksAdded.forEach(rm => currentRunemarks.add(rm));
    }

    // Add archetype attack profile if it exists
    if (archetype.profile) {
      const archetypeProfile = calculateWeaponProfile(archetype.profile, currentFighterStats, null);
      if (archetypeProfile) {
        fighterAttackProfiles.push({
          name: archetype.profile.name,
          profile: archetypeProfile
        });
      }
    }

    // Archetype restrictions
    if (archetype.restrictions) {
      if (archetype.restrictions.forbiddenFighters && archetype.restrictions.forbiddenFighters.includes(fighter.name)) {
        validationMessages.push(`${fighter.name} cannot be a ${archetype.name}.`);
      }
      if (archetype.restrictions.forbiddenFactions && archetype.restrictions.forbiddenFactions.includes(selectedFactionRunemark)) {
        validationMessages.push(`${selectedFactionRunemark} cannot have a ${archetype.name} archetype.`);
      }
    }
  }


  // --- Primary Weapon ---
  const selectedPrimaryWeaponDisplayName = document.getElementById('primarySelect').value;
  const selectedPrimaryWeaponName = getPrimaryWeaponNameFromDisplay(selectedPrimaryWeaponDisplayName);
  const primaryWeapon = data.primaryWeapons.find(w => w.name === selectedPrimaryWeaponName);

  if (primaryWeapon) {
    totalPoints += primaryWeapon.points;

    // Apply weapon-specific effects to fighter (e.g., unarmed in melee)
    applyFighterEffects(currentFighterStats, primaryWeapon.fighterEffects);

    // Primary weapon attack profile
    if (primaryWeapon.profile) {
      const weaponProfile = calculateWeaponProfile(primaryWeapon.profile, currentFighterStats, primaryWeapon.effects);
      fighterAttackProfiles.push({
        name: primaryWeapon.name,
        profile: weaponProfile
      });

      // Determine if unarmed profile is required
      // This is true if the weapon explicitly states it, OR if it's a ranged-only weapon (min range > 0)
      if ((primaryWeapon.fighterEffects && primaryWeapon.fighterEffects.unarmedInMelee) ||
        (weaponProfile.range && weaponProfile.range[0] > 0 && !fighterAttackProfiles.some(p => p.profile.range && p.profile.range[0] === 0))) {
        primaryWeaponRequiresUnarmed = true;
      }
    } else {
      validationMessages.push(`Warning: Primary weapon "${primaryWeapon.name}" has no defined attack profile.`);
    }

    // Apply primary weapon effects to fighter's stats if any
    applyFighterEffects(currentFighterStats, primaryWeapon.fighterEffects);
  }

  // --- Secondary Equipment ---
  const selectedSecondaryWeaponName = document.getElementById('secondarySelect').value;
  const secondaryWeapon = data.secondaryWeapons.find(w => w.name === selectedSecondaryWeaponName);

  if (secondaryWeapon && selectedSecondaryWeaponName !== 'None') {
    totalPoints += secondaryWeapon.points;

    // Apply fighter effects from secondary weapon (e.g., toughness bonus from shield)
    applyFighterEffects(currentFighterStats, secondaryWeapon.fighterEffects);

    // Add secondary weapon attack profile if it exists
    if (secondaryWeapon.profile) {
      const weaponProfile = calculateWeaponProfile(secondaryWeapon.profile, currentFighterStats, secondaryWeapon.effects);
      fighterAttackProfiles.push({
        name: secondaryWeapon.name,
        profile: weaponProfile
      });
    }

    // Secondary weapon restrictions
    if (rules.secondaryWeaponRequiresOneHanded && primaryWeapon && primaryWeapon.handedness === "two") {
      validationMessages.push(`Cannot take a secondary weapon with a Two-handed primary weapon.`);
    }
  }

  // --- Mount ---
  const selectedMountName = document.getElementById('mountSelect').value;
  const mount = data.mounts.find(m => m.name === selectedMountName);

  if (mount && selectedMountName !== 'None') {
    totalPoints += mount.points;

    // Apply fighter effects from mount (movement, wounds)
    applyFighterEffects(currentFighterStats, mount.fighterEffects);

    // Add mount runemarks
    if (mount.runemarksAdded) {
      mount.runemarksAdded.forEach(rm => currentRunemarks.add(rm));
    }

    // Add mount attack profile
    if (mount.profile) {
      const mountProfile = calculateWeaponProfile(mount.profile, currentFighterStats, mount.effects);
      fighterAttackProfiles.push({
        name: mount.profile.name,
        profile: mountProfile
      });
    }

    // Mount restrictions
    if (mount.restrictions) {
      if (mount.restrictions.forbiddenFighters && mount.restrictions.forbiddenFighters.includes(fighter.name)) {
        validationMessages.push(`${fighter.name} cannot take a ${mount.name}.`);
      }
      if (mount.restrictions.maxMovement && currentFighterStats.movement > mount.restrictions.maxMovement) {
        currentFighterStats.movement = mount.restrictions.maxMovement; // Cap movement
      }
      if (mount.restrictions.noMountedRunemarkFor && mount.restrictions.noMountedRunemarkFor.includes(fighter.name)) {
        currentRunemarks.delete('Mounted'); // Remove Mounted runemark if specified
      }
    }
  }


  // --- Divine Blessing ---
  const selectedBlessingName = document.getElementById('blessingSelect').value;
  const blessing = data.divineBlessings.find(b => b.name === selectedBlessingName);
  let blessingEffectText = 'None';

  if (blessing && selectedBlessingName !== 'None') {
    totalPoints += currentFighterStats.W >= 23 ? blessing.pointsHigh : blessing.pointsLow;
    blessingEffectText = blessing.description;

    // Apply fighter effects from blessing
    applyFighterEffects(currentFighterStats, blessing.fighterEffects);

    // Apply weapon effects from blessing
    if (blessing.weaponEffect && blessing.targetable) {
      let targetProfileIndex = -1;
      // Find a target profile based on blessing.targetProfile ('melee', 'any', etc.)
      // For now, let's assume it applies to the first eligible profile.
      // A more complex UI would let the user choose.
      if (blessing.targetProfile === 'melee') {
        targetProfileIndex = fighterAttackProfiles.findIndex(p => p.profile.range && p.profile.range[0] === 0);
      } else if (blessing.targetProfile === 'any') {
        targetProfileIndex = 0; // Apply to first profile
      }

      if (targetProfileIndex !== -1) {
        // Create a copy to modify
        const modifiedProfile = { ...fighterAttackProfiles[targetProfileIndex].profile
        };
        applyFighterEffects(modifiedProfile, blessing.weaponEffect);
        fighterAttackProfiles[targetProfileIndex].profile = modifiedProfile; // Update the profile
      } else {
        validationMessages.push(`Divine Blessing "${blessing.name}" requires a suitable target weapon profile that was not found.`);
      }
    }
  }
  document.getElementById('blessingEffect').textContent = blessingEffectText;


  // --- Additional Runemark ---
  const selectedRunemarkName = document.getElementById('runemarkSelect').value;
  const extraRunemark = data.extraRunemarks.find(r => r.name === selectedRunemarkName);

  if (extraRunemark && selectedRunemarkName !== 'None') {
    if (extraRunemark.restrictions && extraRunemark.restrictions.cannotBeMounted && mount && selectedMountName !== 'None') {
      validationMessages.push(`Cannot take ${extraRunemark.name} with a mount.`);
    } else {
      totalPoints += extraRunemark.points;
      currentRunemarks.add(extraRunemark.name);
    }
  }

  // --- Unarmed Profile ---
  if (primaryWeaponRequiresUnarmed) {
    const unarmedProfile = calculateWeaponProfile({
      name: 'Unarmed',
      range: [0, 1],
      attacks: currentFighterStats.A,
      strength: currentFighterStats.S,
      damage: currentFighterStats.D,
      crit: currentFighterStats.C,
      weaponRunemark: "Fist"
    }, currentFighterStats, {
      attackBonus: rules.unarmedPenalties.attackPenalty,
      damageBonus: rules.unarmedPenalties.damagePenalty,
      critBonus: rules.unarmedPenalties.critPenalty
    });
    fighterAttackProfiles.push({
      name: 'Unarmed',
      profile: unarmedProfile
    });
  }


  // Display Stats
  document.getElementById('statMv').textContent = currentFighterStats.Mv;
  document.getElementById('statT').textContent = currentFighterStats.T;
  document.getElementById('statW').textContent = currentFighterStats.W;

  const runemarkDisplay = document.getElementById('runemarkDisplay');
  const uniqueRunemarks = Array.from(currentRunemarks).filter(rm => rm !== 'None');
  runemarkDisplay.textContent = uniqueRunemarks.length > 0 ? uniqueRunemarks.join(', ') : 'None';

  // Display Attack Profiles
  const attackProfilesUl = document.getElementById('attackProfiles');
  attackProfilesUl.innerHTML = '';
  if (fighterAttackProfiles.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No attack profiles.';
    attackProfilesUl.appendChild(li);
  } else {
    fighterAttackProfiles.forEach(ap => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${ap.name}:</strong> 
        Range ${ap.profile.range[0]}"-${ap.profile.range[1]}", 
        Attacks ${ap.profile.attacks}, 
        Strength ${ap.profile.strength}, 
        Damage ${ap.profile.damage}/${ap.profile.crit}
        ${ap.profile.weaponRunemark ? `(${ap.profile.weaponRunemark})` : ''}
        `;
      attackProfilesUl.appendChild(li);
    });
  }

  document.getElementById('pointsTotal').textContent = totalPoints;

  const validationMessagesDiv = document.getElementById('validationMessages');
  validationMessagesDiv.innerHTML = '';
  if (validationMessages.length > 0) {
    const ul = document.createElement('ul');
    validationMessages.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    });
    validationMessagesDiv.appendChild(ul);
  }
}

// Function to save the current build to local storage
function saveBuild() {
  const build = {
    fighterName: document.getElementById('fighterNameInput').value,
    fighter: document.getElementById('fighterSelect').value,
    faction: document.getElementById('factionSelect').value,
    archetype: document.getElementById('archetypeSelect').value,
    primary: document.getElementById('primarySelect').value,
    secondary: document.getElementById('secondarySelect').value,
    mount: document.getElementById('mountSelect').value,
    blessing: document.getElementById('blessingSelect').value,
    extraRunemark: document.getElementById('runemarkSelect').value
  };
  localStorage.setItem('warcryBuild', JSON.stringify(build));
  alert('Build saved locally!');
}

// Function to load a build from local storage
function loadBuild() {
  const savedBuild = localStorage.getItem('warcryBuild');
  if (savedBuild) {
    const build = JSON.parse(savedBuild);
    document.getElementById('fighterNameInput').value = build.fighterName || '';
    document.getElementById('fighterSelect').value = build.fighter || '';
    updateFactionOptions(); // Update faction options before setting value
    document.getElementById('factionSelect').value = build.faction || '';
    document.getElementById('archetypeSelect').value = build.archetype || '';
    document.getElementById('primarySelect').value = build.primary || '';
    document.getElementById('secondarySelect').value = build.secondary || '';
    document.getElementById('mountSelect').value = build.mount || '';
    document.getElementById('blessingSelect').value = build.blessing || '';
    document.getElementById('runemarkSelect').value = build.extraRunemark || '';
    updateSummary();
    alert('Build loaded from local storage!');
  } else {
    alert('No saved build found.');
  }
}

// Function to load build from a file (TXT)
function loadBuildFromFile() {
  const input = document.getElementById('loadFileInput');
  input.click(); // Trigger the file input click programmatically

  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseAndLoadBuild(content);
    };
    reader.readAsText(file);
  };
}

function parseAndLoadBuild(content) {
  const lines = content.split('\n').filter(line => line.includes(':'));
  const map = {};
  lines.forEach(line => {
    const parts = line.split(':');
    if (parts.length > 1) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim(); // Handle cases where value might have colons
      map[key] = value;
    }
  });

  // Now, populate the form fields based on the map
  const selectMap = {
    'Fighter': 'fighterSelect',
    'Faction': 'factionSelect',
    'Archetype': 'archetypeSelect',
    'Primary': 'primarySelect',
    'Secondary': 'secondarySelect',
    'Mount': 'mountSelect',
    'Blessing': 'blessingSelect',
    'Extra Runemark': 'runemarkSelect'
  };

  for (const label in selectMap) {
    const id = selectMap[label];
    if (map[label]) {
      if (label === 'Primary') {
        const weapon = data.primaryWeapons.find(w => w.name === map[label]);
        if (weapon) {
          document.getElementById(id).value = `${weapon.name} (${weapon.handedness.charAt(0).toUpperCase() + weapon.handedness.slice(1)}-handed)`;
        }
      } else {
        document.getElementById(id).value = map[label];
      }
    }
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
Primary: ${getPrimaryWeaponNameFromDisplay(document.getElementById('primarySelect').value)}
Secondary: ${document.getElementById('secondarySelect').value}
Mount: ${document.getElementById('mountSelect').value}
Blessing: ${document.getElementById('blessingSelect').value}
Extra Runemark: ${document.getElementById('runemarkSelect').value}
Total Points: ${document.getElementById('pointsTotal').textContent}`;
}

function exportBuildPDF() {
  const {
    jsPDF
  } = window.jspdf;
  const pdf = new jsPDF();
  const content = document.getElementById('statsDisplay').innerText;
  pdf.setFontSize(12);
  pdf.text(content, 10, 10);
  pdf.save('warcry_fighter_build.pdf');
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
