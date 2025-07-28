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
  updateSummary(); // Initial summary update
}

function populateSelections() {
  fillSelect('fighterSelect', data.fighters.map(f => f.name));
  fillSelect('archetypeSelect', ['None'].concat(data.archetypes.map(a => a.name)));
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

  updateFactionOptions(); // Call once to set initial faction options
}

function fillSelect(selectId, options) {
  const select = document.getElementById(selectId);
  select.innerHTML = '';
  options.forEach(optionText => {
    const option = document.createElement('option');
    option.textContent = optionText;
    option.value = optionText;
    select.appendChild(option);
  });
}

function updateFactionOptions() {
  const selectedFighterName = document.getElementById('fighterSelect').value;
  const selectedFighter = data.fighters.find(f => f.name === selectedFighterName);
  const factionSelect = document.getElementById('factionSelect');

  factionSelect.innerHTML = ''; // Clear existing options

  if (selectedFighter && selectedFighter.factionRunemarks && selectedFighter.factionRunemarks.length > 0) {
    fillSelect('factionSelect', selectedFighter.factionRunemarks);
  } else {
    // If no specific faction runemarks, allow a "None" option or a generic one
    fillSelect('factionSelect', ['None']);
  }
  updateSummary(); // Update summary after faction changes
}


function getPrimaryWeaponNameFromDisplay(displayString) {
  const match = displayString.match(/(.*) \((?:One|Two)-handed\)/);
  return match ? match[1] : displayString;
}


function updateSummary() {
  let totalPoints = 0;
  let validationMessages = [];
  const selectedFighterName = document.getElementById('fighterSelect').value;
  const fighter = data.fighters.find(f => f.name === selectedFighterName);

  if (!fighter) {
    document.getElementById('validationMessages').textContent = 'Please select a fighter.';
    return;
  }

  // Base Stats from Fighter
  let currentMv = fighter.Mv;
  let currentT = fighter.T;
  let currentW = fighter.W;
  let currentRunemarks = new Set(fighter.runemarks || []);
  let fighterAttackProfiles = [];

  totalPoints += fighter.points;
  document.getElementById('fighterType').textContent = fighter.name;
  document.getElementById('fighterName').textContent = document.getElementById('fighterNameInput').value || 'Unnamed';
  document.getElementById('factionRunemarkDisplay').textContent = document.getElementById('factionSelect').value;


  // Apply Archetype
  const selectedArchetypeName = document.getElementById('archetypeSelect').value;
  const archetype = data.archetypes.find(a => a.name === selectedArchetypeName);
  if (archetype && selectedArchetypeName !== 'None') {
    totalPoints += archetype.points;
    if (archetype.runemarksAdded) {
      archetype.runemarksAdded.forEach(rm => currentRunemarks.add(rm));
    }
    if (archetype.fighterEffects) {
      currentMv += archetype.fighterEffects.movementBonus || 0;
      currentT += archetype.fighterEffects.toughnessBonus || 0;
      currentW += archetype.fighterEffects.woundsBonus || 0;
    }
    // Handle Mage's special attack profile
    if (archetype.name === 'Mage' && archetype.profile) {
      const mageProfile = { ...archetype.profile };
      fighterAttackProfiles.push({ name: 'Arcane Bolt', profile: calculateWeaponProfile(mageProfile, fighter, null) });
    }
  }


  // Apply Primary Weapon
  const selectedPrimaryWeaponDisplay = document.getElementById('primarySelect').value;
  const primaryWeaponName = getPrimaryWeaponNameFromDisplay(selectedPrimaryWeaponDisplay);
  const primaryWeapon = data.primaryWeapons.find(w => w.name === primaryWeaponName);
  let primaryWeaponAddsAttack = false;
  let primaryWeaponIsMelee = false; // Track if primary weapon is a 0 range melee
  let primaryWeaponRequiresUnarmed = false;

  if (primaryWeapon) {
    totalPoints += primaryWeapon.points;
    if (primaryWeapon.profile) {
      fighterAttackProfiles.push({ name: primaryWeapon.name, profile: calculateWeaponProfile(primaryWeapon.profile, fighter, primaryWeapon.effects) });
      primaryWeaponAddsAttack = true;
      if (primaryWeapon.profile.range[0] === 0) {
        primaryWeaponIsMelee = true;
      }
    }
    if (primaryWeapon.fighterEffects && primaryWeapon.fighterEffects.unarmedInMelee) {
      primaryWeaponRequiresUnarmed = true;
    }
  }


  // Apply Secondary Equipment
  const selectedSecondaryWeaponName = document.getElementById('secondarySelect').value;
  const secondaryWeapon = data.secondaryWeapons.find(w => w.name === selectedSecondaryWeaponName);
  let secondaryWeaponAddsAttack = false;

  if (secondaryWeapon && selectedSecondaryWeaponName !== 'None') {
    totalPoints += secondaryWeapon.points;
    if (secondaryWeapon.profile) {
      fighterAttackProfiles.push({ name: secondaryWeapon.name, profile: calculateWeaponProfile(secondaryWeapon.profile, fighter, secondaryWeapon.effects) });
      secondaryWeaponAddsAttack = true;
    }
    if (secondaryWeapon.fighterEffects) {
      currentMv += secondaryWeapon.fighterEffects.movementBonus || 0;
      currentT += secondaryWeapon.fighterEffects.toughnessBonus || 0;
      currentW += secondaryWeapon.fighterEffects.woundsBonus || 0;
    }
  }

  // Apply Mount
  const selectedMountName = document.getElementById('mountSelect').value;
  const mount = data.mounts.find(m => m.name === selectedMountName);
  if (mount && selectedMountName !== 'None') {
    totalPoints += mount.points;
    if (mount.runemarksAdded) {
      // Malignant restriction for Mounted runemark
      if (!(mount.runemarksAdded.includes('Mounted') && fighter.factionRunemarks.includes('Malignant'))) {
        mount.runemarksAdded.forEach(rm => currentRunemarks.add(rm));
      }
    }
    if (mount.fighterEffects) {
      currentMv += mount.fighterEffects.movementBonus || 0;
      currentT += mount.fighterEffects.toughnessBonus || 0;
      currentW += mount.fighterEffects.woundsBonus || 0;
    }
    if (mount.profile) {
      fighterAttackProfiles.push({ name: mount.profile.name, profile: calculateWeaponProfile(mount.profile, fighter, mount.effects) });
    }
  }


  // Apply Divine Blessing
  const selectedBlessingName = document.getElementById('blessingSelect').value;
  const blessing = data.divineBlessings.find(b => b.name === selectedBlessingName);
  if (blessing && selectedBlessingName !== 'None') {
    const blessingPoints = currentW < 23 ? blessing.pointsLow : blessing.pointsHigh;
    totalPoints += blessingPoints;

    if (blessing.fighterEffects) {
      currentMv += blessing.fighterEffects.movementBonus || 0;
      currentT += blessing.fighterEffects.toughnessBonus || 0;
      currentW += blessing.fighterEffects.woundsBonus || 0;
    }
    if (blessing.weaponEffect) {
      // Apply weapon effect to the targeted weapon profile
      const targetProfileType = blessing.targetProfile;
      fighterAttackProfiles.forEach(ap => {
        const weaponRunemark = ap.profile.weaponRunemark;
        if (targetProfileType === 'any' || (targetProfileType === 'melee' && ap.profile.range[0] === 0)) {
          ap.profile.attacks += blessing.weaponEffect.attackBonus || 0;
          ap.profile.strength += blessing.weaponEffect.strengthBonus || 0;
          ap.profile.damage += blessing.weaponEffect.damageBonus || 0;
          ap.profile.crit += blessing.weaponEffect.critBonus || 0;
        }
      });
    }
  }


  // Apply Additional Runemark
  const selectedRunemarkName = document.getElementById('runemarkSelect').value;
  if (selectedRunemarkName !== 'None') {
    const extraRunemark = data.extraRunemarks.find(r => r.name === selectedRunemarkName);
    if (extraRunemark) {
      totalPoints += extraRunemark.points;
      currentRunemarks.add(extraRunemark.name);
    }
  }

  // --- Post-calculation validations and adjustments ---

  // Unarmed Profile Generation
  let hasMeleeWeapon = false;
  if (primaryWeapon && primaryWeapon.profile && primaryWeapon.profile.range[0] === 0 && !primaryWeaponRequiresUnarmed) {
    hasMeleeWeapon = true;
  }
  if (secondaryWeapon && secondaryWeapon.profile && secondaryWeapon.profile.range[0] === 0) { // Check if secondary is also a melee weapon
    hasMeleeWeapon = true;
  }
  if (mount && mount.profile && mount.profile.range[0] === 0) { // Check if mount attack is a melee weapon
    hasMeleeWeapon = true;
  }
  if (!hasMeleeWeapon || primaryWeaponRequiresUnarmed) {
    const unarmedProfile = {
      range: [0, 1],
      attacks: Math.max(rules.unarmedPenalties.minimumValues.attacks, fighter.A + rules.unarmedPenalties.attackPenalty),
      strength: Math.max(rules.unarmedPenalties.minimumValues.strength, fighter.S + rules.unarmedPenalties.strengthPenalty), // Assuming strength penalty if exists
      damage: Math.max(rules.unarmedPenalties.minimumValues.damage, fighter.D + rules.unarmedPenalties.damagePenalty),
      crit: Math.max(rules.unarmedPenalties.minimumValues.crit, fighter.C + rules.unarmedPenalties.critPenalty),
      weaponRunemark: "Fist"
    };
    // Ensure "unarmed" profile is only added if no other melee weapon is present, or if the primary explicitly makes the fighter unarmed in melee.
    let meleeAttackExists = fighterAttackProfiles.some(ap => ap.profile.range[0] === 0);
    if (!meleeAttackExists || primaryWeaponRequiresUnarmed) {
      fighterAttackProfiles.unshift({ name: 'Unarmed', profile: unarmedProfile }); // Add to beginning for prominence
    }
  }


  // Max Attack Actions Validation
  if (fighterAttackProfiles.length > rules.maxAttackActions) {
    validationMessages.push(`Warning: A fighter can have a maximum of ${rules.maxAttackActions} attack actions. This fighter has ${fighterAttackProfiles.length}.`);
  }

  // Max Runemarks Validation
  if (currentRunemarks.size > rules.maxRunemarks) {
    validationMessages.push(`Warning: A fighter can have a maximum of ${rules.maxRunemarks} runemarks. This fighter has ${currentRunemarks.size}.`);
  }

  // Secondary Weapon Handedness Restriction
  if (secondaryWeapon && selectedSecondaryWeaponName !== 'None' && rules.secondaryWeaponRequiresOneHanded) {
    if (primaryWeapon && primaryWeapon.handedness === 'two') {
      validationMessages.push('Warning: A secondary equipment can only be taken if the primary weapon is one-handed.');
    }
  }

  // Update Display
  document.getElementById('statMv').textContent = currentMv;
  document.getElementById('statT').textContent = currentT;
  document.getElementById('statW').textContent = currentW;
  document.getElementById('runemarkDisplay').textContent = Array.from(currentRunemarks).join(', ');

  const attackProfilesUl = document.getElementById('attackProfiles');
  attackProfilesUl.innerHTML = '';
  fighterAttackProfiles.forEach(ap => {
    const li = document.createElement('li');
    li.textContent = `${ap.name}: Range [${ap.profile.range.join('"-')}"], Attacks ${ap.profile.attacks}, Strength ${ap.profile.strength}, Damage ${ap.profile.damage}, Crit ${ap.profile.crit} (Runemark: ${ap.profile.weaponRunemark || 'None'})`;
    attackProfilesUl.appendChild(li);
  });

  document.getElementById('blessingEffect').textContent = blessing && blessing.specialEffect ? blessing.specialEffect : 'None';
  document.getElementById('pointsTotal').textContent = totalPoints;

  document.getElementById('validationMessages').innerHTML = validationMessages.map(msg => `<li>${msg}</li>`).join('');
}


function calculateWeaponProfile(profile, fighter, effects) {
  const calculatedProfile = { ...profile
  };

  // Replace 'base' placeholders with fighter's base stats
  calculatedProfile.range = calculatedProfile.range.map(val => {
    if (val === 'baseReach') return fighter.R;
    return val;
  });
  calculatedProfile.attacks = calculatedProfile.attacks === 'baseAttacks' ? fighter.A : calculatedProfile.attacks;
  calculatedProfile.strength = calculatedProfile.strength === 'baseStrength' ? fighter.S : calculatedProfile.strength;
  calculatedProfile.damage = calculatedProfile.damage === 'baseDamage' ? fighter.D : calculatedProfile.damage;
  calculatedProfile.crit = calculatedProfile.crit === 'baseCrit' ? fighter.C : calculatedProfile.crit;

  // Apply weapon-specific effects (from the weapon's own 'effects' field)
  if (effects) {
    calculatedProfile.range[1] = (calculatedProfile.range[1] || 0) + (effects.rangeBonus || 0); // Assuming rangeBonus adds to max range
    calculatedProfile.attacks += (effects.attackBonus || 0);
    calculatedProfile.strength += (effects.strengthBonus || 0);
    calculatedProfile.damage += (effects.damageBonus || 0);
    calculatedProfile.crit += (effects.critBonus || 0);
  }

  return calculatedProfile;
}


// Save/Load Functions
function saveBuild() {
  const build = {
    fighterName: document.getElementById('fighterNameInput').value,
    fighter: document.getElementById('fighterSelect').value,
    faction: document.getElementById('factionSelect').value,
    archetype: document.getElementById('archetypeSelect').value,
    primaryWeapon: document.getElementById('primarySelect').value,
    secondaryEquipment: document.getElementById('secondarySelect').value,
    mount: document.getElementById('mountSelect').value,
    divineBlessing: document.getElementById('blessingSelect').value,
    extraRunemark: document.getElementById('runemarkSelect').value
  };
  localStorage.setItem('warcryBuild', JSON.stringify(build));
  alert('Build saved locally!');
}

function loadBuild() {
  const savedBuild = localStorage.getItem('warcryBuild');
  if (savedBuild) {
    const build = JSON.parse(savedBuild);
    document.getElementById('fighterNameInput').value = build.fighterName || '';
    document.getElementById('fighterSelect').value = build.fighter || '';
    updateFactionOptions(); // Update factions after setting fighter
    document.getElementById('factionSelect').value = build.faction || 'None';
    document.getElementById('archetypeSelect').value = build.archetype || 'None';
    document.getElementById('primarySelect').value = build.primaryWeapon || '';
    document.getElementById('secondarySelect').value = build.secondaryEquipment || 'None';
    document.getElementById('mountSelect').value = build.mount || 'None';
    document.getElementById('blessingSelect').value = build.divineBlessing || 'None';
    document.getElementById('runemarkSelect').value = build.extraRunemark || 'None';
    updateSummary();
    alert('Build loaded from local storage!');
  } else {
    alert('No saved build found.');
  }
}

function loadBuildFromFile() {
  document.getElementById('loadFileInput').click();
}

document.getElementById('loadFileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const build = JSON.parse(e.target.result);
        document.getElementById('fighterNameInput').value = build.fighterName || '';
        document.getElementById('fighterSelect').value = build.fighter || '';
        updateFactionOptions(); // Update factions after setting fighter
        document.getElementById('factionSelect').value = build.faction || 'None';
        document.getElementById('archetypeSelect').value = build.archetype || 'None';
        document.getElementById('primarySelect').value = build.primaryWeapon || '';
        document.getElementById('secondarySelect').value = build.secondaryEquipment || 'None';
        document.getElementById('mountSelect').value = build.mount || 'None';
        document.getElementById('blessingSelect').value = build.divineBlessing || 'None';
        document.getElementById('runemarkSelect').value = build.extraRunemark || 'None';
        updateSummary();
        alert('Build loaded from file!');
      } catch (error) {
        alert('Error loading build from file: Invalid JSON format.');
        console.error('Error parsing JSON from file:', error);
      }
    };
    reader.readAsText(file);
  }
});


function exportBuildPDF() {
  const {
    jsPDF
  } = window.jspdf;
  const pdf = new jsPDF();

  const fighterName = document.getElementById('fighterNameInput').value || 'Unnamed Fighter';
  const fighterType = document.getElementById('fighterSelect').value;
  const factionRunemark = document.getElementById('factionSelect').value;
  const runemarks = document.getElementById('runemarkDisplay').textContent;
  const mv = document.getElementById('statMv').textContent;
  const t = document.getElementById('statT').textContent;
  const w = document.getElementById('statW').textContent;
  const attackProfilesUl = document.getElementById('attackProfiles');
  const blessingEffect = document.getElementById('blessingEffect').textContent;
  const totalPoints = document.getElementById('pointsTotal').textContent;

  let y = 10;
  pdf.setFontSize(16);
  pdf.text(`Warcry Anvil of Apotheosis Fighter Profile`, 10, y);
  y += 10;

  pdf.setFontSize(12);
  pdf.text(`Fighter Name: ${fighterName}`, 10, y);
  y += 7;
  pdf.text(`Fighter Type: ${fighterType}`, 10, y);
  y += 7;
  pdf.text(`Faction Runemark: ${factionRunemark}`, 10, y);
  y += 7;
  pdf.text(`Runemarks: ${runemarks}`, 10, y);
  y += 10;

  pdf.setFontSize(14);
  pdf.text(`Core Stats:`, 10, y);
  y += 7;
  pdf.setFontSize(12);
  pdf.text(`Movement: ${mv}, Toughness: ${t}, Wounds: ${w}`, 10, y);
  y += 10;

  pdf.setFontSize(14);
  pdf.text(`Attack Profiles:`, 10, y);
  y += 7;
  pdf.setFontSize(12);
  Array.from(attackProfilesUl.children).forEach(li => {
    pdf.text(li.textContent, 15, y);
    y += 7;
  });
  y += 3;

  pdf.setFontSize(12);
  pdf.text(`Divine Blessing: ${blessingEffect}`, 10, y);
  y += 10;

  pdf.setFontSize(14);
  pdf.text(`Total Points: ${totalPoints}`, 10, y);

  pdf.save(`${fighterName.replace(/\s/g, '_')}_Warcry_Profile.pdf`);
}


// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
