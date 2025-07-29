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
  // Add event listeners for all relevant select elements and the name input
  document.getElementById('fighterSelect').addEventListener('change', updateSummary);
  document.getElementById('factionSelect').addEventListener('change', updateSummary);
  document.getElementById('archetypeSelect').addEventListener('change', updateSummary);
  document.getElementById('primarySelect').addEventListener('change', updateSummary);
  document.getElementById('secondarySelect').addEventListener('change', updateSummary);
  document.getElementById('mountSelect').addEventListener('change', updateSummary);
  document.getElementById('blessingSelect').addEventListener('change', updateSummary);
  document.getElementById('runemarkSelect').addEventListener('change', updateSummary);
  document.getElementById('fighterNameInput').addEventListener('input', updateSummary); // Listen for name changes

  // Initial call to updateSummary after data is loaded and selections are populated
  updateSummary();
}

function fillSelect(elementId, options) {
  const select = document.getElementById(elementId);
  select.innerHTML = ''; // Clear existing options
  options.forEach(optionText => {
    const option = document.createElement('option');
    option.textContent = optionText;
    option.value = optionText;
    select.appendChild(option);
  });
}

function getSelectedData(elementId, dataset) {
  const select = document.getElementById(elementId);
  const selectedName = select.value;
  if (selectedName === 'None') return null;

  // Handle specific cases where the display name is different from the actual name
  if (elementId === 'primarySelect' || elementId === 'secondarySelect') {
    const actualName = selectedName.split(' (')[0]; // Extract actual name from "Name (Handedness)"
    return dataset.find(item => item.name === actualName);
  }

  return dataset.find(item => item.name === selectedName);
}

function updateSummary() {
  const validationMessagesDiv = document.getElementById('validationMessages');
  validationMessagesDiv.innerHTML = ''; // Clear previous messages
  let messages = [];

  const fighterNameInput = document.getElementById('fighterNameInput').value;
  document.getElementById('fighterName').textContent = fighterNameInput || 'Un-named Fighter';

  const selectedFighter = getSelectedData('fighterSelect', data.fighters);
  let currentPoints = 0;
  let currentFighter = { // Initialize with base fighter stats
    Mv: 0,
    T: 0,
    W: 0,
    R: 0,
    A: 0,
    S: 0,
    D: 0,
    C: 0
  };
  let currentRunemarks = [];
  let currentFactionRunemark = 'None';
  let currentAttackProfiles = [];
  let hasMeleeWeapon = false; // Flag to check if any selected weapon is melee

  // 1. Base Fighter Selection
  if (selectedFighter) {
    currentPoints += selectedFighter.points;
    Object.assign(currentFighter, selectedFighter); // Copy base stats
    currentRunemarks = [...selectedFighter.runemarks]; // Start with base runemarks

    // Populate faction runemarks based on selected fighter
    fillSelect('factionSelect', ['None'].concat(selectedFighter.factionRunemarks));
    // If a faction was previously selected and is still valid, keep it. Otherwise, default to the first valid one or 'None'.
    const currentFactionSelection = document.getElementById('factionSelect').value;
    if (selectedFighter.factionRunemarks.includes(currentFactionSelection)) {
      currentFactionRunemark = currentFactionSelection;
    } else if (selectedFighter.factionRunemarks.length > 0) {
      currentFactionRunemark = selectedFighter.factionRunemarks[0];
      document.getElementById('factionSelect').value = currentFactionRunemark;
    } else {
      currentFactionRunemark = 'None';
      document.getElementById('factionSelect').value = 'None';
    }
  } else {
    // Reset faction select if no fighter is chosen
    fillSelect('factionSelect', ['None']);
    document.getElementById('factionSelect').value = 'None';
  }
  document.getElementById('fighterType').textContent = selectedFighter ? selectedFighter.name : '-';
  document.getElementById('factionRunemarkDisplay').textContent = currentFactionRunemark;


  // 2. Archetype Selection
  const selectedArchetype = getSelectedData('archetypeSelect', data.archetypes);
  if (selectedArchetype) {
    // Archetype Restrictions
    if (selectedFighter && selectedArchetype.restrictions) {
      if (selectedArchetype.restrictions.forbiddenFighters.includes(selectedFighter.name)) {
        messages.push(`${selectedFighter.name} cannot be a ${selectedArchetype.name}. Please choose a different Archetype.`);
        document.getElementById('archetypeSelect').value = 'Commander'; // Revert to default
        updateSummary(); // Re-run summary with corrected archetype
        return;
      }
      if (selectedArchetype.restrictions.forbiddenFactions.includes(currentFactionRunemark)) {
        messages.push(`${currentFactionRunemark} cannot have a ${selectedArchetype.name} Archetype. Please choose a different Archetype.`);
        document.getElementById('archetypeSelect').value = 'Commander'; // Revert to default
        updateSummary(); // Re-run summary with corrected archetype
        return;
      }
    }

    currentPoints += selectedArchetype.points;
    if (selectedArchetype.fighterEffects) {
      if (selectedArchetype.fighterEffects.movementBonus) currentFighter.Mv += selectedArchetype.fighterEffects.movementBonus;
      if (selectedArchetype.fighterEffects.toughnessBonus) currentFighter.T += selectedArchetype.fighterEffects.toughnessBonus;
      if (selectedArchetype.fighterEffects.woundsBonus) currentFighter.W += selectedArchetype.fighterEffects.woundsBonus;
      if (selectedArchetype.fighterEffects.meleeAttackBonus) currentFighter.A += selectedArchetype.fighterEffects.meleeAttackBonus;
      // Apply minimums if specified
      if (selectedArchetype.fighterEffects.meleeAttackMin && currentFighter.A < selectedArchetype.fighterEffects.meleeAttackMin) {
        currentFighter.A = selectedArchetype.fighterEffects.meleeAttackMin;
      }
    }
    if (selectedArchetype.runemarksAdded) {
      selectedArchetype.runemarksAdded.forEach(rm => {
        if (!currentRunemarks.includes(rm)) {
          currentRunemarks.push(rm);
        }
      });
    }
  }

  // 3. Primary Weapon Selection
  const selectedPrimaryWeapon = getSelectedData('primarySelect', data.primaryWeapons);
  // Filter secondary weapons based on primary weapon handedness
  const availableSecondaryWeapons = ['None'];
  if (selectedPrimaryWeapon && selectedPrimaryPrimaryWeapon.handedness === 'one') {
    availableSecondaryWeapons.push(...data.secondaryWeapons.map(w => w.name));
  }
  fillSelect('secondarySelect', availableSecondaryWeapons);

  // If a secondary weapon was previously selected and is no longer valid, reset it
  const currentSecondarySelection = document.getElementById('secondarySelect').value;
  if (!availableSecondaryWeapons.includes(currentSecondarySelection)) {
    document.getElementById('secondarySelect').value = 'None';
  }

  // Primary Weapon Restrictions (e.g., Mage must use one-handed primary)
  if (selectedArchetype && selectedArchetype.restrictions && selectedArchetype.restrictions.mustUseOneHandedPrimary) {
    if (selectedPrimaryWeapon && selectedPrimaryWeapon.handedness !== 'one') {
      messages.push(`${selectedArchetype.name} Archetype requires a one-handed primary weapon.`);
      // Revert primary weapon selection if invalid
      document.getElementById('primarySelect').value = data.primaryWeapons[0].name + ' (' + data.primaryWeapons[0].handedness.charAt(0).toUpperCase() + data.primaryWeapons[0].handedness.slice(1) + '-handed)';
      updateSummary();
      return;
    }
  }

  if (selectedPrimaryWeapon) {
    currentPoints += selectedPrimaryWeapon.points;
  }

  // 4. Secondary Equipment Selection
  const selectedSecondaryWeapon = getSelectedData('secondarySelect', data.secondaryWeapons);
  // Secondary Equipment Restrictions (e.g., Mage cannot select secondary equipment)
  if (selectedArchetype && selectedArchetype.restrictions && selectedArchetype.restrictions.forbidSecondaryEquipment) {
    if (selectedSecondaryWeapon) {
      messages.push(`${selectedArchetype.name} Archetype forbids secondary equipment.`);
      document.getElementById('secondarySelect').value = 'None'; // Revert secondary weapon selection
      updateSummary();
      return;
    }
  }

  if (selectedSecondaryWeapon) {
    currentPoints += selectedSecondaryWeapon.points;
    if (selectedSecondaryWeapon.fighterEffects) {
      if (selectedSecondaryWeapon.fighterEffects.toughnessBonus) currentFighter.T += selectedSecondaryWeapon.fighterEffects.toughnessBonus;
    }
  }

  // 5. Mount Selection
  const selectedMount = getSelectedData('mountSelect', data.mounts);
  if (selectedMount) {
    if (selectedMount.restrictions && selectedMount.restrictions.forbiddenFighters.includes(selectedFighter.name)) {
      messages.push(`${selectedFighter.name} cannot take a ${selectedMount.name}.`);
      document.getElementById('mountSelect').value = 'None'; // Revert mount selection
      updateSummary();
      return;
    }

    currentPoints += selectedMount.points;
    if (selectedMount.fighterEffects) {
      if (selectedMount.fighterEffects.movementBonus) {
        currentFighter.Mv += selectedMount.fighterEffects.movementBonus;
        // Apply max movement restriction from mount
        if (selectedMount.restrictions && selectedMount.restrictions.maxMovement && currentFighter.Mv > selectedMount.restrictions.maxMovement) {
          currentFighter.Mv = selectedMount.restrictions.maxMovement;
        }
      }
      if (selectedMount.fighterEffects.woundsBonus) currentFighter.W += selectedMount.fighterEffects.woundsBonus;
    }
    if (selectedMount.runemarksAdded) {
      selectedMount.runemarksAdded.forEach(rm => {
        // Check for specific restriction for Malignants not gaining Mounted runemark
        if (!(rm === "Mounted" && selectedMount.restrictions.noMountedRunemarkFor && selectedMount.restrictions.noMountedRunemarkFor.includes(selectedFighter.name))) {
          if (!currentRunemarks.includes(rm)) {
            currentRunemarks.push(rm);
          }
        }
      });
    }
  }

  // 6. Divine Blessing Selection
  const selectedBlessing = getSelectedData('blessingSelect', data.divineBlessings);
  let blessingEffectText = 'None';
  if (selectedBlessing) {
    const pointsKey = currentFighter.W < 23 ? 'pointsLow' : 'pointsHigh';
    currentPoints += selectedBlessing[pointsKey];
    blessingEffectText = selectedBlessing.description || selectedBlessing.specialEffect || selectedBlessing.name;

    if (selectedBlessing.fighterEffects) {
      if (selectedBlessing.fighterEffects.movementBonus) currentFighter.Mv += selectedBlessing.fighterEffects.movementBonus;
      if (selectedBlessing.fighterEffects.toughnessBonus) currentFighter.T += selectedBlessing.fighterEffects.toughnessBonus;
      if (selectedBlessing.fighterEffects.woundsBonus) currentFighter.W += selectedBlessing.fighterEffects.woundsBonus;
    }
  }
  document.getElementById('blessingEffect').textContent = blessingEffectText;

  // 7. Additional Runemark Selection
  const selectedRunemark = getSelectedData('runemarkSelect', data.extraRunemarks);
  if (selectedRunemark) {
    // Check if 'Fly' runemark is selected and fighter is mounted
    if (selectedRunemark.name === 'Fly' && selectedMount) {
      messages.push(`Cannot select 'Fly' runemark if the fighter is mounted.`);
      document.getElementById('runemarkSelect').value = 'None'; // Revert runemark selection
      updateSummary();
      return;
    }
    // Check for other restrictions from extra runemarks
    if (selectedRunemark.restrictions && selectedRunemark.restrictions.cannotBeMounted && selectedMount) {
      messages.push(`${selectedRunemark.name} runemark cannot be taken by a mounted fighter.`);
      document.getElementById('runemarkSelect').value = 'None'; // Revert runemark selection
      updateSummary();
      return;
    }

    currentPoints += selectedRunemark.points;
    if (!currentRunemarks.includes(selectedRunemark.name)) {
      currentRunemarks.push(selectedRunemark.name);
    }
  }

  // Runemark Limit Validation
  if (currentRunemarks.length > rules.maxRunemarks) {
    messages.push(`A fighter can have a maximum of ${rules.maxRunemarks} runemarks. Please adjust your selections.`);
  }

  // --- Attack Profile Calculation ---
  // Start with an empty list for the final attack profiles
  let finalAttackProfiles = [];

  // Add the unarmed profile first
  const unarmedProfile = {
    name: "Unarmed",
    range: [0, 1],
    attacks: Math.max(currentFighter.A + rules.unarmedPenalties.attackPenalty, rules.unarmedPenalties.minimumValues.attacks),
    strength: currentFighter.S, // No strength penalty for unarmed
    damage: Math.max(currentFighter.D + rules.unarmedPenalties.damagePenalty, rules.unarmedPenalties.minimumValues.damage),
    crit: Math.max(currentFighter.C + rules.unarmedPenalties.critPenalty, rules.unarmedPenalties.minimumValues.crit),
    weaponRunemark: "Fist" // Generic unarmed runemark
  };
  finalAttackProfiles.push(unarmedProfile);
  hasMeleeWeapon = false; // Reset for recalculation based on current selections

  // Process Primary Weapon
  if (selectedPrimaryWeapon && selectedPrimaryWeapon.profile) {
    const profile = { ...selectedPrimaryWeapon.profile };
    profile.name = selectedPrimaryWeapon.name;

    // Resolve "base" stats using currentFighter's modified stats
    profile.attacks = profile.attacks === "baseAttacks" ? currentFighter.A : profile.attacks;
    profile.strength = profile.strength === "baseStrength" ? currentFighter.S : profile.strength;
    profile.damage = profile.damage === "baseDamage" ? currentFighter.D : profile.damage;
    profile.crit = profile.crit === "baseCrit" ? currentFighter.C : profile.crit;
    profile.range[1] = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1]; // Resolve baseReach

    // Apply weapon's own effects (range, attack, strength, damage, crit bonuses)
    if (selectedPrimaryWeapon.effects) {
      profile.range[1] += (selectedPrimaryWeapon.effects.rangeBonus || 0);
      profile.attacks += (selectedPrimaryWeapon.effects.attackBonus || 0);
      profile.strength += (selectedPrimaryWeapon.effects.strengthBonus || 0);
      profile.damage += (selectedPrimaryWeapon.effects.damageBonus || 0);
      profile.crit += (selectedPrimaryWeapon.effects.critBonus || 0);
    }

    finalAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) { // Check if it's a melee weapon
      hasMeleeWeapon = true;
    }
  }

  // Process Secondary Equipment
  if (selectedSecondaryWeapon && selectedSecondaryWeapon.profile) {
    const profile = { ...selectedSecondaryWeapon.profile };
    profile.name = selectedSecondaryWeapon.name;

    // Resolve "base" stats using currentFighter's modified stats
    profile.attacks = profile.attacks === "baseAttacks" ? currentFighter.A : profile.attacks;
    profile.strength = profile.strength === "baseStrength" ? currentFighter.S : profile.strength;
    profile.damage = profile.damage === "baseDamage" ? currentFighter.D : profile.damage;
    profile.crit = profile.crit === "baseCrit" ? currentFighter.C : profile.crit;
    profile.range[1] = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1]; // Resolve baseReach

    // Apply weapon's own effects
    if (selectedSecondaryWeapon.effects) {
      profile.range[1] += (selectedSecondaryWeapon.effects.rangeBonus || 0);
      profile.attacks += (selectedSecondaryWeapon.effects.attackBonus || 0);
      profile.strength += (selectedSecondaryWeapon.effects.strengthBonus || 0);
      profile.damage += (selectedSecondaryWeapon.effects.damageBonus || 0);
      profile.crit += (selectedSecondaryWeapon.effects.critBonus || 0);
    }

    finalAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Process Archetype Attack Profile
  if (selectedArchetype && selectedArchetype.profile) {
    const profile = { ...selectedArchetype.profile };
    profile.name = selectedArchetype.profile.name;
    finalAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Process Mount Attack Profile
  if (selectedMount && selectedMount.profile) {
    const profile = { ...selectedMount.profile };
    profile.name = selectedMount.profile.name;
    finalAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Conditional Unarmed Removal: Remove the unarmed profile if any melee weapon is present
  if (hasMeleeWeapon) {
    finalAttackProfiles = finalAttackProfiles.filter(p => p.name !== "Unarmed");
  }

  // Apply Divine Blessing Weapon Effects (after all profiles are determined)
  if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect) {
    let blessingApplied = false;
    for (let i = 0; i < finalAttackProfiles.length; i++) {
      const profile = finalAttackProfiles[i];
      const isMelee = profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0);

      if (selectedBlessing.targetProfile === "melee" && isMelee) {
        // Apply to the first eligible melee weapon
        profile.attacks += (selectedBlessing.weaponEffect.attackBonus || 0);
        profile.strength += (selectedBlessing.weaponEffect.strengthBonus || 0);
        profile.damage += (selectedBlessing.weaponEffect.damageBonus || 0);
        profile.crit += (selectedBlessing.weaponEffect.critBonus || 0);
        blessingApplied = true;
        break; // Only apply to one weapon
      } else if (selectedBlessing.targetProfile === "any") {
        // Apply to the first weapon regardless of type
        profile.attacks += (selectedBlessing.weaponEffect.attackBonus || 0);
        profile.strength += (selectedBlessing.weaponEffect.strengthBonus || 0);
        profile.damage += (selectedBlessing.weaponEffect.damageBonus || 0);
        profile.crit += (selectedBlessing.weaponEffect.critBonus || 0);
        blessingApplied = true;
        break; // Only apply to one weapon
      }
    }
    if (!blessingApplied) {
      messages.push(`Selected Divine Blessing '${selectedBlessing.name}' could not be applied to any weapon.`);
    }
  }

  // Max Attack Actions Validation
  if (finalAttackProfiles.length > rules.maxAttackActions) {
    messages.push(`A fighter can have a maximum of ${rules.maxAttackActions} attack actions. Please adjust your equipment selections.`);
  }

  // --- Update Display ---
  document.getElementById('statMv').textContent = currentFighter.Mv;
  document.getElementById('statT').textContent = currentFighter.T;
  document.getElementById('statW').textContent = currentFighter.W;

  document.getElementById('runemarkDisplay').textContent = currentRunemarks.length > 0 ? currentRunemarks.join(', ') : 'None';

  const attackProfilesUl = document.getElementById('attackProfiles');
  attackProfilesUl.innerHTML = '';
  if (finalAttackProfiles.length > 0) {
    finalAttackProfiles.forEach(profile => {
      const li = document.createElement('li');
      li.textContent = `${profile.name}: Range ${profile.range[0]}"-${profile.range[1]}", Attacks ${profile.attacks}, Strength ${profile.strength}, Damage ${profile.damage}/${profile.crit} (Crit)`;
      attackProfilesUl.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No attack profiles available.';
    attackProfilesUl.appendChild(li);
  }

  document.getElementById('pointsTotal').textContent = currentPoints;

  if (messages.length > 0) {
    validationMessagesDiv.innerHTML = messages.map(msg => `<p>${msg}</p>`).join('');
  }
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
  // Default to Hand Weapon if available, otherwise the first option
  document.getElementById('primarySelect').value = primaryWeaponOptions.includes('Hand Weapon (One-handed)') ? 'Hand Weapon (One-handed)' : primaryWeaponOptions[0];


  // Secondary weapons are filtered dynamically based on primary weapon in updateSummary
  fillSelect('secondarySelect', ['None']);

  fillSelect('blessingSelect', ['None'].concat(data.divineBlessings.map(b => b.name)));
}


function saveBuild() {
  const fighterName = document.getElementById('fighterNameInput').value;
  const fighterType = document.getElementById('fighterSelect').value;
  const factionRunemark = document.getElementById('factionSelect').value;
  const archetype = document.getElementById('archetypeSelect').value;
  const primaryWeapon = document.getElementById('primarySelect').value;
  const secondaryWeapon = document.getElementById('secondarySelect').value;
  const mount = document.getElementById('mountSelect').value;
  const blessing = document.getElementById('blessingSelect').value;
  const runemark = document.getElementById('runemarkSelect').value;

  const build = {
    fighterName,
    fighterType,
    factionRunemark,
    archetype,
    primaryWeapon,
    secondaryWeapon,
    mount,
    blessing,
    runemark
  };

  localStorage.setItem('warcryFighterBuild', JSON.stringify(build));
  alert('Fighter build saved locally!'); // Replaced with custom modal in a real app
}

function loadBuild() {
  const savedBuild = localStorage.getItem('warcryFighterBuild');
  if (savedBuild) {
    const build = JSON.parse(savedBuild);
    document.getElementById('fighterNameInput').value = build.fighterName || '';
    document.getElementById('fighterSelect').value = build.fighterType || '';
    // Call updateSummary to repopulate factionSelect before setting its value
    updateSummary();
    document.getElementById('factionSelect').value = build.factionRunemark || '';
    document.getElementById('archetypeSelect').value = build.archetype || '';

    // Set primary weapon, then call updateSummary to populate secondary options
    document.getElementById('primarySelect').value = build.primaryWeapon || '';
    updateSummary(); // This will re-filter secondary and ensure it's valid

    document.getElementById('secondarySelect').value = build.secondaryWeapon || '';
    document.getElementById('mountSelect').value = build.mount || '';
    document.getElementById('blessingSelect').value = build.blessing || '';
    document.getElementById('runemarkSelect').value = build.runemark || '';

    updateSummary(); // Final update to reflect all loaded selections
    alert('Fighter build loaded from local storage!'); // Replaced with custom modal in a real app
  } else {
    alert('No saved build found!'); // Replaced with custom modal in a real app
  }
}

function loadBuildFromFile() {
  const input = document.getElementById('loadFileInput');
  input.click(); // Trigger file input click

  input.onchange = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const build = JSON.parse(e.target.result);
        document.getElementById('fighterNameInput').value = build.fighterName || '';
        document.getElementById('fighterSelect').value = build.fighterType || '';
        updateSummary(); // Repopulate factionSelect
        document.getElementById('factionSelect').value = build.factionRunemark || '';
        document.getElementById('archetypeSelect').value = build.archetype || '';
        document.getElementById('primarySelect').value = build.primaryWeapon || '';
        updateSummary(); // Repopulate secondarySelect
        document.getElementById('secondarySelect').value = build.secondaryWeapon || '';
        document.getElementById('mountSelect').value = build.mount || '';
        document.getElementById('blessingSelect').value = build.blessing || '';
        document.getElementById('runemarkSelect').value = build.runemark || '';
        updateSummary(); // Final update
        alert('Fighter build loaded from file!'); // Replaced with custom modal in a real app
      } catch (error) {
        alert('Error loading file: Invalid JSON format.'); // Replaced with custom modal in a real app
        console.error('Error parsing loaded file:', error);
      }
    };
    reader.readAsText(file);
  };
}


function exportBuildPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const fighterName = document.getElementById('fighterName').textContent;
  const fighterType = document.getElementById('fighterType').textContent;
  const factionRunemark = document.getElementById('factionRunemarkDisplay').textContent;
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
    pdf.text(li.textContent, 10, y);
    y += 7;
  });
  y += 10;

  pdf.setFontSize(14);
  pdf.text(`Divine Blessing:`, 10, y);
  y += 7;
  pdf.setFontSize(12);
  pdf.text(blessingEffect, 10, y);
  y += 10;

  pdf.setFontSize(14);
  pdf.text(`Total Points: ${totalPoints}`, 10, y);

  pdf.save(`${fighterName.replace(/ /g, '_')}_Warcry_Fighter_Profile.pdf`);
}


// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
