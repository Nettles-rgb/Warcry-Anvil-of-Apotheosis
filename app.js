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
  // Archetypes are filtered dynamically in updateSummary, initially just populate all valid ones,
  // and set 'Commander' as default. 'None' is not an option for archetype.
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
  // Add 'input' event listener for real-time updates on fighter name
  document.getElementById('fighterNameInput').addEventListener('input', updateSummary);

  updateFactionOptions(); // Call once to set initial faction options
}

function fillSelect(selectId, options) {
  const select = document.getElementById(selectId);
  // Store the current value before clearing options
  const currentValue = select.value;
  select.innerHTML = '';
  options.forEach(optionText => {
    const option = document.createElement('option');
    option.textContent = optionText;
    option.value = optionText;
    select.appendChild(option);
  });
  // Attempt to restore the previous value if it's still valid
  if (options.includes(currentValue)) {
    select.value = currentValue;
  }
}

function updateFactionOptions() {
  const selectedFighterName = document.getElementById('fighterSelect').value;
  const selectedFighter = data.fighters.find(f => f.name === selectedFighterName);
  const factionSelect = document.getElementById('factionSelect');

  factionSelect.innerHTML = ''; // Clear existing options

  if (selectedFighter && selectedFighter.factionRunemarks && selectedFighter.factionRunemarks.length > 0) {
    fillSelect('factionSelect', selectedFighter.factionRunemarks);
  } else {
    fillSelect('factionSelect', ['None']); // Should ideally not happen for valid fighters
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


  // --- Dynamic Filtering of Dropdowns ---

  // 1. Filter Archetypes based on Fighter and Faction
  const archetypeSelectElement = document.getElementById('archetypeSelect');
  const currentArchetypeValue = archetypeSelectElement.value;
  const selectedFaction = document.getElementById('factionSelect').value; // Get currently selected faction

  const validArchetypes = data.archetypes.filter(a => {
    const isForbiddenByFighter = a.restrictions.forbiddenFighters.includes(fighter.name);
    // Only check against the *currently selected* faction runemark
    const isForbiddenByFaction = a.restrictions.forbiddenFactions.includes(selectedFaction);
    return !isForbiddenByFighter && !isForbiddenByFaction;
  });
  fillSelect('archetypeSelect', validArchetypes.map(a => a.name));

  // Try to re-select, otherwise default to 'Commander'
  if (validArchetypes.some(a => a.name === currentArchetypeValue)) {
    archetypeSelectElement.value = currentArchetypeValue;
  } else {
    if (validArchetypes.some(a => a.name === 'Commander')) {
      archetypeSelectElement.value = 'Commander';
    } else if (validArchetypes.length > 0) {
      archetypeSelectElement.value = validArchetypes[0].name; // Fallback to first available
    }
  }


  // 2. Filter Mounts based on Fighter
  const mountSelectElement = document.getElementById('mountSelect');
  const currentMountValue = mountSelectElement.value;
  const validMounts = data.mounts.filter(m => {
    const isForbiddenByFighter = m.restrictions.forbiddenFighters.includes(fighter.name);
    return !isForbiddenByFighter;
  });
  fillSelect('mountSelect', ['None'].concat(validMounts.map(m => m.name)));
  // Try to re-select, otherwise default to 'None'
  if (validMounts.some(m => m.name === currentMountValue) || currentMountValue === 'None') {
    mountSelectElement.value = currentMountValue;
  } else {
    mountSelectElement.value = 'None';
  }


  // Retrieve finalized selections after potential resets
  const archetype = data.archetypes.find(a => a.name === archetypeSelectElement.value);
  const mount = data.mounts.find(m => m.name === mountSelectElement.value) || null;

  const selectedPrimaryWeaponDisplay = document.getElementById('primarySelect').value;
  const primaryWeaponName = getPrimaryWeaponNameFromDisplay(selectedPrimaryWeaponDisplay);
  const primaryWeapon = data.primaryWeapons.find(w => w.name === primaryWeaponName);

  const secondarySelectElement = document.getElementById('secondarySelect');
  let secondaryWeapon = data.secondaryWeapons.find(w => w.name === secondarySelectElement.value) || null;

  const blessing = data.divineBlessings.find(b => b.name === document.getElementById('blessingSelect').value) || null;

  // Secondary Weapon Disable/Reset if primary is two-handed
  if (primaryWeapon && primaryWeapon.handedness === 'two') {
    if (secondarySelectElement.value !== 'None') {
      secondarySelectElement.value = 'None';
      secondaryWeapon = null;
    }
    secondarySelectElement.disabled = true;
  } else {
    secondarySelectElement.disabled = false;
  }


  // Apply Archetype
  if (archetype) {
    totalPoints += archetype.points;
    if (archetype.runemarksAdded) {
      archetype.runemarksAdded.forEach(rm => currentRunemarks.add(rm));
    }
    if (archetype.fighterEffects) {
      currentMv += archetype.fighterEffects.movementBonus || 0;
      currentT += archetype.fighterEffects.toughnessBonus || 0;
      currentW += archetype.fighterEffects.woundsBonus || 0;
      // Apply direct attack/strength/damage/crit changes from archetype
      // These are not weapon-specific bonuses, but overall fighter stats for general calculations
      fighter.A += archetype.fighterEffects.meleeAttackBonus || 0;
      if (archetype.fighterEffects.meleeAttackMin) {
        fighter.A = Math.max(fighter.A, archetype.fighterEffects.meleeAttackMin);
      }
    }
    // Handle Mage's special attack profile
    if (archetype.name === 'Mage' && archetype.profile) {
      const mageProfile = { ...archetype.profile
      };
      fighterAttackProfiles.push({
        name: archetype.profile.name || 'Arcane Bolt',
        profile: calculateWeaponProfile(mageProfile, fighter, null)
      });
    }
  }


  // Apply Primary Weapon
  let primaryWeaponRequiresUnarmed = false;
  if (primaryWeapon) {
    totalPoints += primaryWeapon.points;
    if (primaryWeapon.profile) {
      fighterAttackProfiles.push({
        name: primaryWeapon.name,
        profile: calculateWeaponProfile(primaryWeapon.profile, fighter, primaryWeapon.effects)
      });
    }
    if (primaryWeapon.fighterEffects && primaryWeapon.fighterEffects.unarmedInMelee) {
      primaryWeaponRequiresUnarmed = true;
    }
  }


  // Apply Secondary Equipment
  if (secondaryWeapon && secondarySelectElement.value !== 'None') {
    totalPoints += secondaryWeapon.points;
    if (secondaryWeapon.profile) {
      fighterAttackProfiles.push({
        name: secondaryWeapon.name,
        profile: calculateWeaponProfile(secondaryWeapon.profile, fighter, secondaryWeapon.effects)
      });
    }
    if (secondaryWeapon.fighterEffects) {
      currentMv += secondaryWeapon.fighterEffects.movementBonus || 0;
      currentT += secondaryWeapon.fighterEffects.toughnessBonus || 0;
      currentW += secondaryWeapon.fighterEffects.woundsBonus || 0;
    }
  }

  // Apply Mount
  if (mount && mountSelectElement.value !== 'None') {
    totalPoints += mount.points;
    if (mount.runemarksAdded) {
      // Malignant restriction for Mounted runemark - Removed the warning message here
      if (!(fighter.name === 'Malignant' && mount.runemarksAdded.includes('Mounted'))) {
        mount.runemarksAdded.forEach(rm => currentRunemarks.add(rm));
      }
    }
    if (mount.fighterEffects) {
      currentMv += mount.fighterEffects.movementBonus || 0;
      currentT += mount.fighterEffects.toughnessBonus || 0;
      currentW += mount.fighterEffects.woundsBonus || 0;
    }
    if (mount.profile) {
      fighterAttackProfiles.push({
        name: mount.profile.name,
        profile: calculateWeaponProfile(mount.profile, fighter, mount.effects)
      });
    }
  }


  // Apply Divine Blessing
  let blessingEffectText = 'None';
  if (blessing && document.getElementById('blessingSelect').value !== 'None') {
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
        // Apply only if the profile matches the target type (e.g., 'melee' or 'any')
        const isMelee = ap.profile.range[0] === 0;
        if (targetProfileType === 'any' || (targetProfileType === 'melee' && isMelee)) {
          ap.profile.attacks += blessing.weaponEffect.attackBonus || 0;
          ap.profile.strength += blessing.weaponEffect.strengthBonus || 0;
          ap.profile.damage += blessing.weaponEffect.damageBonus || 0;
          ap.profile.crit += blessing.weaponEffect.critBonus || 0;
        }
      });
    }
    blessingEffectText = blessing.specialEffect || 'Stat bonuses applied.';
  }


  // 3. Filter Additional Runemarks based on accumulated runemarks (including faction)
  const runemarkSelectElement = document.getElementById('runemarkSelect');
  const currentRunemarkValue = runemarkSelectElement.value;
  const allCurrentRunemarksSet = new Set([...currentRunemarks, document.getElementById('factionSelect').value]); // Use Set for uniqueness

  const validExtraRunemarks = data.extraRunemarks.filter(r => {
    // If an extra runemark has a 'cannotBeMounted' restriction, and a mount is selected, it's invalid.
    if (mount && mount.name !== 'None' && r.restrictions.cannotBeMounted) {
      return false;
    }
    // Only include if not already present in unique set of current runemarks
    return !allCurrentRunemarksSet.has(r.name);
  });
  fillSelect('runemarkSelect', ['None'].concat(validExtraRunemarks.map(r => r.name)));
  // Try to re-select, otherwise default to 'None'
  if (validExtraRunemarks.some(r => r.name === currentRunemarkValue) || currentRunemarkValue === 'None') {
    runemarkSelectElement.value = currentRunemarkValue;
  } else {
    runemarkSelectElement.value = 'None';
  }
  let extraRunemark = data.extraRunemarks.find(r => r.name === runemarkSelectElement.value) || null;


  // Apply Additional Runemark
  if (extraRunemark && runemarkSelectElement.value !== 'None') {
    totalPoints += extraRunemark.points;
    currentRunemarks.add(extraRunemark.name);
  }

  // --- Post-calculation validations and adjustments ---

  // Unarmed Profile Generation
  let hasEquippedMeleeWeapon = fighterAttackProfiles.some(ap => ap.profile.range[0] === 0);

  // If no equipped melee weapon OR the primary weapon makes the fighter count as unarmed in melee
  if (!hasEquippedMeleeWeapon || primaryWeaponRequiresUnarmed) {
    const unarmedProfile = {
      name: 'Unarmed',
      range: [0, 1],
      attacks: Math.max(rules.unarmedPenalties.minimumValues.attacks, fighter.A + rules.unarmedPenalties.attackPenalty),
      strength: Math.max(rules.unarmedPenalties.minimumValues.strength, fighter.S + rules.unarmedPenalties.strengthPenalty),
      damage: Math.max(rules.unarmedPenalties.minimumValues.damage, fighter.D + rules.unarmedPenalties.damagePenalty),
      crit: Math.max(rules.unarmedPenalties.minimumValues.crit, fighter.C + rules.unarmedPenalties.critPenalty),
      weaponRunemark: "Fist"
    };

    // Add unarmed profile only if it's not already covered by another 0-range attack
    // or if explicitly required by primary weapon (overriding other melee options)
    let shouldAddUnarmed = true;
    if (hasEquippedMeleeWeapon && !primaryWeaponRequiresUnarmed) {
      shouldAddUnarmed = false; // Only add if no other melee weapon AND not forced by primary weapon
    }

    if (shouldAddUnarmed) {
      // Remove any existing 'Unarmed' profile to prevent duplicates on successive updates
      fighterAttackProfiles = fighterAttackProfiles.filter(ap => ap.name !== 'Unarmed');
      fighterAttackProfiles.unshift(unarmedProfile); // Add to beginning for prominence
    }
  } else {
    // If a melee weapon is present and unarmed is not required, ensure 'Unarmed' profile is removed if it exists
    fighterAttackProfiles = fighterAttackProfiles.filter(ap => ap.name !== 'Unarmed');
  }


  // Max Attack Actions Validation
  if (fighterAttackProfiles.length > rules.maxAttackActions) {
    validationMessages.push(`Warning: A fighter can have a maximum of ${rules.maxAttackActions} attack actions. This fighter has ${fighterAttackProfiles.length}.`);
  }

  // Max Runemarks Validation
  if (currentRunemarks.size > rules.maxRunemarks) {
    validationMessages.push(`Warning: A fighter can have a maximum of ${rules.maxRunemarks} runemarks. This fighter has ${currentRunemarks.size}.`);
  }

  // Update Display
  document.getElementById('statMv').textContent = currentMv;
  document.getElementById('statT').textContent = currentT;
  document.getElementById('statW').textContent = currentW;
  document.getElementById('runemarkDisplay').textContent = Array.from(currentRunemarks).join(', ') || '-';

  const attackProfilesUl = document.getElementById('attackProfiles');
  attackProfilesUl.innerHTML = '';
  fighterAttackProfiles.forEach(ap => {
    const li = document.createElement('li');
    li.textContent = `${ap.name}: Range [${Array.isArray(ap.profile.range) ? ap.profile.range.join('-') : ap.profile.range}"], Attacks ${ap.profile.attacks}, Strength ${ap.profile.strength}, Damage ${ap.profile.damage}, Crit ${ap.profile.crit} (Runemark: ${ap.profile.weaponRunemark || 'None'})`;
    attackProfilesUl.appendChild(li);
  });

  document.getElementById('blessingEffect').textContent = blessingEffectText;
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
    updateFactionOptions(); // Update factions after setting fighter, which will then call updateSummary
    // Use a short delay to ensure updateFactionOptions completes DOM updates before setting value
    setTimeout(() => {
      document.getElementById('factionSelect').value = build.faction || 'None';
      document.getElementById('archetypeSelect').value = build.archetype || 'Commander';
      document.getElementById('primarySelect').value = build.primaryWeapon || '';
      document.getElementById('secondarySelect').value = build.secondaryEquipment || 'None';
      document.getElementById('mountSelect').value = build.mount || 'None';
      document.getElementById('blessingSelect').value = build.divineBlessing || 'None';
      document.getElementById('runemarkSelect').value = build.extraRunemark || 'None';
      updateSummary(); // Final update after all values are set
    }, 50);
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
        updateFactionOptions(); // Update factions after setting fighter, which will then call updateSummary
        setTimeout(() => {
          document.getElementById('factionSelect').value = build.faction || 'None';
          document.getElementById('archetypeSelect').value = build.archetype || 'Commander';
          document.getElementById('primarySelect').value = build.primaryWeapon || '';
          document.getElementById('secondarySelect').value = build.secondaryEquipment || 'None';
          document.getElementById('mountSelect').value = build.mount || 'None';
          document.getElementById('blessingSelect').value = build.divineBlessing || 'None';
          document.getElementById('runemarkSelect').value = build.extraRunemark || 'None';
          updateSummary(); // Final update after all values are set
        }, 50);
        alert('Build loaded from file!');
      } catch (error) {
        alert('Error loading build from file: Invalid JSON format.');
        console.error('Error parsing JSON from file:', error);
      }
    };
    reader.readAsText(file);
  }
});


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
