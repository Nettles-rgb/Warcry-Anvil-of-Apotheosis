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
  // New event listener for the blessing target weapon select
  document.getElementById('blessingTargetWeaponSelect').addEventListener('change', updateSummary);
  document.getElementById('runemarkSelect').addEventListener('change', updateSummary);
  document.getElementById('fighterNameInput').addEventListener('input', updateSummary); // Listen for name changes

  // Initial call to updateSummary after data is loaded and selections are populated
  updateSummary();
}

/**
 * Fills a select element with options.
 * @param {string} elementId - The ID of the select element.
 * @param {Array<string>} options - An array of strings for the options.
 * @param {boolean} allowNone - Whether to include a 'None' option.
 */
function fillSelect(elementId, options, allowNone = true) {
  const select = document.getElementById(elementId);
  const currentValue = select.value; // Store current value
  select.innerHTML = ''; // Clear existing options

  let finalOptions = [...options];
  if (allowNone) {
    finalOptions = ['None'].concat(options);
  }

  finalOptions.forEach(optionText => {
    const option = document.createElement('option');
    option.textContent = optionText;
    option.value = optionText;
    select.appendChild(option);
  });

  // Attempt to restore the previous selection if it's still a valid option
  if (finalOptions.includes(currentValue)) {
    select.value = currentValue;
  } else if (allowNone) {
    select.value = 'None'; // Default to 'None' if allowed
  } else if (finalOptions.length > 0) {
    select.value = finalOptions[0]; // Default to first option if 'None' not allowed
  }
}

/**
 * Retrieves the selected data object from a dataset based on the select element's value.
 * Handles special cases for weapon names.
 * @param {string} elementId - The ID of the select element.
 * @param {Array<Object>} dataset - The array of data objects (e.g., data.fighters, data.primaryWeapons).
 * @returns {Object|null} The selected data object or null if 'None' is selected or not found.
 */
function getSelectedData(elementId, dataset) {
  const select = document.getElementById(elementId);
  const selectedName = select.value;
  if (selectedName === 'None' || !selectedName) return null; // Handle empty string or 'None'

  // Handle specific cases where the display name is different from the actual name
  if (elementId === 'primarySelect' || elementId === 'secondarySelect') {
    const actualName = selectedName.split(' (')[0]; // Extract actual name from "Name (Handedness)"
    return dataset.find(item => item.name === actualName);
  }

  return dataset.find(item => item.name === selectedName);
}

/**
 * Updates the fighter summary based on current selections.
 */
function updateSummary() {
  const validationMessagesDiv = document.getElementById('validationMessages');
  validationMessagesDiv.innerHTML = ''; // Clear previous messages
  let messages = [];

  const fighterNameInput = document.getElementById('fighterNameInput').value;
  document.getElementById('fighterName').textContent = fighterNameInput || 'Un-named Fighter';

  let currentPoints = 0;
  // Initialize currentFighter with default zero values, then apply base fighter stats
  let currentFighter = {
    Mv: 0, T: 0, W: 0, R: 0, A: 0, S: 0, D: 0, C: 0
  };
  let currentRunemarks = [];
  let currentFactionRunemark = 'None';
  let hasMeleeWeapon = false; // Flag to check if any selected weapon is usable in base combat

  // --- 1. Base Fighter Selection ---
  const selectedFighter = getSelectedData('fighterSelect', data.fighters);
  if (selectedFighter) {
    currentPoints += selectedFighter.points;
    // Deep copy base fighter stats to avoid modifying the original data object
    Object.assign(currentFighter, JSON.parse(JSON.stringify(selectedFighter)));
    currentRunemarks = [...selectedFighter.runemarks]; // Start with base runemarks

    // Populate faction runemarks based on selected fighter
    // Do NOT allow 'None' if there are actual faction runemarks
    fillSelect('factionSelect', selectedFighter.factionRunemarks, selectedFighter.factionRunemarks.length === 0);
    currentFactionRunemark = document.getElementById('factionSelect').value; // Get the selected faction after potential repopulation
  } else {
    // Reset faction select if no fighter is chosen
    fillSelect('factionSelect', ['None'], true);
    currentFactionRunemark = 'None';
  }
  document.getElementById('fighterType').textContent = selectedFighter ? selectedFighter.name : '-';
  document.getElementById('factionRunemarkDisplay').textContent = currentFactionRunemark;

  // --- 2. Archetype Selection ---
  let selectedArchetype = getSelectedData('archetypeSelect', data.archetypes);
  let archetypeInvalid = false;
  if (selectedArchetype) {
    if (selectedFighter && selectedArchetype.restrictions) {
      if (selectedArchetype.restrictions.forbiddenFighters.includes(selectedFighter.name)) {
        messages.push(`${selectedFighter.name} cannot be a ${selectedArchetype.name}. Reverting Archetype to Commander.`);
        archetypeInvalid = true;
      }
      if (!archetypeInvalid && selectedArchetype.restrictions.forbiddenFactions.includes(currentFactionRunemark)) {
        messages.push(`${currentFactionRunemark} cannot have a ${selectedArchetype.name} Archetype. Reverting Archetype to Commander.`);
        archetypeInvalid = true;
      }
    }
  }

  if (archetypeInvalid) {
    document.getElementById('archetypeSelect').value = 'Commander'; // Revert to default
    selectedArchetype = data.archetypes.find(a => a.name === 'Commander'); // Get the reverted archetype
  }

  if (selectedArchetype) { // Process the (potentially reverted) archetype
    currentPoints += selectedArchetype.points;
    if (selectedArchetype.fighterEffects) {
      Object.keys(selectedArchetype.fighterEffects).forEach(key => {
        if (key.endsWith('Bonus')) {
          const statKey = key.replace('Bonus', ''); // e.g., 'movement' from 'movementBonus'
          const capitalizedStatKey = statKey.charAt(0).toUpperCase() + statKey.slice(1); // Mv, T, W, A
          if (currentFighter[capitalizedStatKey] !== undefined) {
            currentFighter[capitalizedStatKey] += selectedArchetype.fighterEffects[key];
          }
        } else if (key === 'meleeAttackMin') {
          if (currentFighter.A < selectedArchetype.fighterEffects.meleeAttackMin) {
            currentFighter.A = selectedArchetype.fighterEffects.meleeAttackMin;
          }
        }
      });
    }
    if (selectedArchetype.runemarksAdded) {
      selectedArchetype.runemarksAdded.forEach(rm => {
        if (!currentRunemarks.includes(rm)) {
          currentRunemarks.push(rm);
        }
      });
    }
  }

  // --- 3. Primary Weapon Selection ---
  let selectedPrimaryWeapon = getSelectedData('primarySelect', data.primaryWeapons);
  let primaryWeaponInvalid = false;

  // Primary Weapon Restrictions (e.g., Mage must use one-handed primary)
  if (selectedArchetype && selectedArchetype.restrictions && selectedArchetype.restrictions.mustUseOneHandedPrimary) {
    if (selectedPrimaryWeapon && selectedPrimaryWeapon.handedness !== 'one') {
      messages.push(`${selectedArchetype.name} Archetype requires a one-handed primary weapon. Reverting Primary Weapon.`);
      primaryWeaponInvalid = true;
    }
  }

  if (primaryWeaponInvalid) {
    // Revert primary weapon selection if invalid (default to Hand Weapon)
    const defaultPrimary = data.primaryWeapons.find(w => w.name === 'Hand Weapon') || data.primaryWeapons[0];
    document.getElementById('primarySelect').value = `${defaultPrimary.name} (${defaultPrimary.handedness.charAt(0).toUpperCase() + defaultPrimary.handedness.slice(1)}-handed)`;
    selectedPrimaryWeapon = defaultPrimary; // Update selectedPrimaryWeapon to the valid one
  }

  if (selectedPrimaryWeapon) { // Process the (potentially reverted) primary weapon
    currentPoints += selectedPrimaryWeapon.points;
  }

  // Filter secondary weapons based on primary weapon handedness
  const availableSecondaryWeapons = [];
  if (selectedPrimaryWeapon && selectedPrimaryWeapon.handedness === 'one') {
    availableSecondaryWeapons.push(...data.secondaryWeapons.map(w => w.name));
  }
  fillSelect('secondarySelect', availableSecondaryWeapons, true); // Repopulate secondary select, allowing 'None'

  // --- 4. Secondary Equipment Selection ---
  let selectedSecondaryWeapon = getSelectedData('secondarySelect', data.secondaryWeapons);
  let secondaryWeaponInvalid = false;

  // Secondary Equipment Restrictions (e.g., Mage cannot select secondary equipment)
  if (selectedArchetype && selectedArchetype.restrictions && selectedArchetype.restrictions.forbidSecondaryEquipment) {
    if (selectedSecondaryWeapon) {
      messages.push(`${selectedArchetype.name} Archetype forbids secondary equipment. Reverting Secondary Equipment.`);
      secondaryWeaponInvalid = true;
    }
  }

  if (secondaryWeaponInvalid) {
    document.getElementById('secondarySelect').value = 'None'; // Revert secondary weapon selection
    selectedSecondaryWeapon = null; // Ensure selectedSecondaryWeapon is null for subsequent logic
  }

  if (selectedSecondaryWeapon) { // Process the (potentially reverted) secondary weapon
    currentPoints += selectedSecondaryWeapon.points;
    if (selectedSecondaryWeapon.fighterEffects) {
      if (selectedSecondaryWeapon.fighterEffects.toughnessBonus) currentFighter.T += selectedSecondaryWeapon.fighterEffects.toughnessBonus;
    }
  }

  // --- 5. Mount Selection ---
  let selectedMount = getSelectedData('mountSelect', data.mounts);
  let mountInvalid = false;
  if (selectedMount) {
    if (selectedFighter && selectedMount.restrictions && selectedMount.restrictions.forbiddenFighters.includes(selectedFighter.name)) {
      messages.push(`${selectedFighter.name} cannot take a ${selectedMount.name}. Reverting Mount.`);
      mountInvalid = true;
    }
  }

  if (mountInvalid) {
    document.getElementById('mountSelect').value = 'None'; // Revert mount selection
    selectedMount = null; // Ensure selectedMount is null for subsequent logic
  }

  if (selectedMount) { // Process the (potentially reverted) mount
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
        if (!(rm === "Mounted" && selectedMount.restrictions.noMountedRunemarkFor && selectedFighter && selectedMount.restrictions.noMountedRunemarkFor.includes(selectedFighter.name))) {
          if (!currentRunemarks.includes(rm)) {
            currentRunemarks.push(rm);
          }
        }
      });
    }
  }

  // --- 6. Divine Blessing Selection ---
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

  // --- 7. Additional Runemark Selection ---
  // Filter available additional runemarks based on already gained runemarks (e.g., from Archetype)
  let availableRunemarks = data.extraRunemarks.map(r => r.name);
  // Remove runemarks already possessed by the fighter
  availableRunemarks = availableRunemarks.filter(rm => !currentRunemarks.includes(rm));

  fillSelect('runemarkSelect', availableRunemarks, true); // Repopulate additional runemark select, allowing 'None'

  let selectedRunemark = getSelectedData('runemarkSelect', data.extraRunemarks);
  let runemarkInvalid = false;
  if (selectedRunemark) {
    // Check if 'Fly' runemark is selected and fighter is mounted
    if (selectedRunemark.name === 'Fly' && selectedMount) {
      messages.push(`Cannot select 'Fly' runemark if the fighter is mounted. Reverting Additional Runemark.`);
      runemarkInvalid = true;
    }
    // Check for other restrictions from extra runemarks
    if (!runemarkInvalid && selectedRunemark.restrictions && selectedRunemark.restrictions.cannotBeMounted && selectedMount) {
      messages.push(`${selectedRunemark.name} runemark cannot be taken by a mounted fighter. Reverting Additional Runemark.`);
      runemarkInvalid = true;
    }
  }

  if (runemarkInvalid) {
    document.getElementById('runemarkSelect').value = 'None'; // Revert runemark selection
    selectedRunemark = null; // Ensure selectedRunemark is null for subsequent logic
  }

  if (selectedRunemark) { // Process the (potentially reverted) additional runemark
    currentPoints += selectedRunemark.points;
    if (!currentRunemarks.includes(selectedRunemark.name)) { // Double check to prevent duplicates
      currentRunemarks.push(selectedRunemark.name);
    }
  }

  // --- Final Attack Profile Generation (after all stats and selections are finalized) ---
  // Start with an empty list for the final attack profiles for the current calculation pass
  let tempAttackProfiles = [];

  // Add the unarmed profile first
  const unarmedProfile = {
    name: "Unarmed",
    range: [0, 1],
    attacks: Math.max(currentFighter.A + (rules.unarmedPenalties.attackPenalty || 0), rules.unarmedPenalties.minimumValues.attacks),
    strength: currentFighter.S, // No strength penalty for unarmed
    damage: Math.max(currentFighter.D + (rules.unarmedPenalties.damagePenalty || 0), rules.unarmedPenalties.minimumValues.damage),
    crit: Math.max(currentFighter.C + (rules.unarmedPenalties.critPenalty || 0), rules.unarmedPenalties.minimumValues.crit),
    weaponRunemark: "Fist" // Generic unarmed runemark
  };
  tempAttackProfiles.push(unarmedProfile);
  hasMeleeWeapon = false; // Reset for recalculation based on current selections

  // Process Primary Weapon (if valid and selected)
  if (selectedPrimaryWeapon && selectedPrimaryWeapon.profile) {
    // Deep copy the profile and its range array to prevent cumulative effects
    const profile = { ...selectedPrimaryWeapon.profile, range: [...selectedPrimaryWeapon.profile.range] };
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

    tempAttackProfiles.push(profile);
    // Check if it's a melee weapon (min range 0 or baseReach which is 0)
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Process Secondary Equipment (if valid and selected)
  if (selectedSecondaryWeapon && selectedSecondaryWeapon.profile) {
    // Deep copy the profile and its range array
    const profile = { ...selectedSecondaryWeapon.profile, range: [...selectedSecondaryWeapon.profile.range] };
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

    tempAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Process Archetype Attack Profile (if valid and selected)
  if (selectedArchetype && selectedArchetype.profile) {
    // Deep copy the profile and its range array
    const profile = { ...selectedArchetype.profile, range: [...selectedArchetype.profile.range] };
    profile.name = selectedArchetype.profile.name;
    // Resolve baseReach for archetype profiles
    profile.range[1] = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1];
    tempAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Process Mount Attack Profile (if valid and selected)
  if (selectedMount && selectedMount.profile) {
    // Deep copy the profile and its range array
    const profile = { ...selectedMount.profile, range: [...selectedMount.profile.range] };
    profile.name = selectedMount.profile.name;
    // Resolve baseReach for mount profiles
    profile.range[1] = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1];
    tempAttackProfiles.push(profile);
    if (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0)) {
      hasMeleeWeapon = true;
    }
  }

  // Conditional Unarmed Removal: Remove the unarmed profile if any weapon usable in base combat is present
  if (hasMeleeWeapon) {
    tempAttackProfiles = tempAttackProfiles.filter(p => p.name !== "Unarmed");
  }

  // Assign to finalAttackProfiles for display and blessing application
  finalAttackProfiles = tempAttackProfiles;

  // --- Divine Blessing Target Weapon Selection Logic ---
  const blessingTargetWeaponSelect = document.getElementById('blessingTargetWeaponSelect');
  let eligibleTargetWeapons = [];

  if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect) {
    eligibleTargetWeapons = finalAttackProfiles.filter(profile => {
      // Resolve range for comparison
      const minRangeResolved = profile.range[0] === "baseReach" ? currentFighter.R : profile.range[0];
      const maxRangeResolved = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1];

      // Define a melee weapon for blessing purposes: min range 0 AND max range <= 3
      const isMeleeForBlessing = (minRangeResolved === 0) && (maxRangeResolved <= 3);

      return (selectedBlessing.targetProfile === "melee" && isMeleeForBlessing) ||
             (selectedBlessing.targetProfile === "any");
    }).map(profile => profile.name);
  }

  fillSelect('blessingTargetWeaponSelect', eligibleTargetWeapons, true); // Allow 'None' for target weapon
  blessingTargetWeaponSelect.disabled = !(selectedBlessing && selectedBlessing.targetable && eligibleTargetWeapons.length > 0);

  const selectedTargetWeaponName = blessingTargetWeaponSelect.value;
  const targetWeaponProfile = finalAttackProfiles.find(p => p.name === selectedTargetWeaponName);

  // Apply Divine Blessing Weapon Effects (only to the selected target weapon)
  if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect && targetWeaponProfile) {
    targetWeaponProfile.attacks = (targetWeaponProfile.attacks || 0) + (selectedBlessing.weaponEffect.attackBonus || 0);
    targetWeaponProfile.strength = (targetWeaponProfile.strength || 0) + (selectedBlessing.weaponEffect.strengthBonus || 0);
    targetWeaponProfile.damage = (targetWeaponProfile.damage || 0) + (selectedBlessing.weaponEffect.damageBonus || 0);
    targetWeaponProfile.crit = (targetWeaponProfile.crit || 0) + (selectedBlessing.weaponEffect.critBonus || 0);
  } else if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect && !targetWeaponProfile && eligibleTargetWeapons.length > 0) {
      messages.push(`Please select a target weapon for the '${selectedBlessing.name}' Divine Blessing.`);
  }


  // Runemark Limit Validation (after all runemarks are accumulated)
  if (currentRunemarks.length > rules.maxRunemarks) {
    messages.push(`A fighter can have a maximum of ${rules.maxRunemarks} runemarks. Please adjust your selections.`);
  }

  // Max Attack Actions Validation (after all profiles are accumulated)
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
      // Ensure range is displayed correctly, handling cases where it might be a string like "baseReach"
      const minRange = profile.range[0] === "baseReach" ? currentFighter.R : profile.range[0];
      const maxRange = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1];
      li.textContent = `${profile.name}: Range ${minRange}"-${maxRange}", Attacks ${profile.attacks}, Strength ${profile.strength}, Damage ${profile.damage}/${profile.crit} (Crit)`;
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

/**
 * Populates the initial selection dropdowns.
 */
function populateSelections() {
  fillSelect('fighterSelect', data.fighters.map(f => f.name), false); // Fighter Type should not allow 'None'
  if (data.fighters.length > 0) {
    document.getElementById('fighterSelect').value = data.fighters[0].name; // Default to the first fighter
  }

  fillSelect('archetypeSelect', data.archetypes.map(a => a.name), false); // Archetype must be selected, no 'None'

  fillSelect('mountSelect', data.mounts.map(m => m.name), true); // Mounts can be 'None'
  // Initially populate all extra runemarks, filtering will happen in updateSummary
  fillSelect('runemarkSelect', data.extraRunemarks.map(r => r.name), true); // Additional Runemarks can be 'None'

  const primaryWeaponOptions = data.primaryWeapons.map(w => `${w.name} (${w.handedness.charAt(0).toUpperCase() + w.handedness.slice(1)}-handed)`);
  fillSelect('primarySelect', primaryWeaponOptions, true); // Primary weapons can be 'None'
  // Default to Hand Weapon if available, otherwise the first option
  document.getElementById('primarySelect').value = primaryWeaponOptions.includes('Hand Weapon (One-handed)') ? 'Hand Weapon (One-handed)' : primaryWeaponOptions[0];

  // Secondary weapons initially only have 'None', will be populated dynamically
  fillSelect('secondarySelect', [], true); // Secondary weapons can be 'None'

  fillSelect('blessingSelect', data.divineBlessings.map(b => b.name), true); // Divine Blessings can be 'None'
  fillSelect('blessingTargetWeaponSelect', [], true); // Initially empty, will be populated dynamically
}

/**
 * Saves the current fighter build to local storage.
 */
function saveBuild() {
  const fighterName = document.getElementById('fighterNameInput').value;
  const fighterType = document.getElementById('fighterSelect').value;
  const factionRunemark = document.getElementById('factionSelect').value;
  const archetype = document.getElementById('archetypeSelect').value;
  const primaryWeapon = document.getElementById('primarySelect').value;
  const secondaryWeapon = document.getElementById('secondarySelect').value;
  const mount = document.getElementById('mountSelect').value;
  const blessing = document.getElementById('blessingSelect').value;
  const blessingTargetWeapon = document.getElementById('blessingTargetWeaponSelect').value; // Save selected target weapon
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
    blessingTargetWeapon, // Add to saved build
    runemark
  };

  localStorage.setItem('warcryFighterBuild', JSON.stringify(build));
  const validationMessagesDiv = document.getElementById('validationMessages');
  validationMessagesDiv.innerHTML = '<p style="color: green;">Fighter build saved locally!</p>';
}

/**
 * Loads a fighter build from local storage.
 */
function loadBuild() {
  const savedBuild = localStorage.getItem('warcryFighterBuild');
  if (savedBuild) {
    const build = JSON.parse(savedBuild);
    document.getElementById('fighterNameInput').value = build.fighterName || '';
    document.getElementById('fighterSelect').value = build.fighterType || '';
    updateSummary(); // This call is crucial to re-filter options before setting values
    document.getElementById('factionSelect').value = build.factionRunemark || '';
    document.getElementById('archetypeSelect').value = build.archetype || '';

    // Set primary weapon, then call updateSummary to populate secondary options
    document.getElementById('primarySelect').value = build.primaryWeapon || '';
    updateSummary(); // This will re-filter secondary and ensure it's valid

    document.getElementById('secondarySelect').value = build.secondaryWeapon || '';
    document.getElementById('mountSelect').value = build.mount || '';
    document.getElementById('blessingSelect').value = build.blessing || '';
    updateSummary(); // This will populate blessingTargetWeaponSelect
    document.getElementById('blessingTargetWeaponSelect').value = build.blessingTargetWeapon || 'None'; // Load selected target weapon
    document.getElementById('runemarkSelect').value = build.runemark || '';

    updateSummary(); // Final update to reflect all loaded selections
    const validationMessagesDiv = document.getElementById('validationMessages');
    validationMessagesDiv.innerHTML = '<p style="color: green;">Fighter build loaded from local storage!</p>';
  } else {
    const validationMessagesDiv = document.getElementById('validationMessages');
    validationMessagesDiv.innerHTML = '<p style="color: red;">No saved build found!</p>';
  }
}

/**
 * Loads a fighter build from a user-selected file.
 */
function loadBuildFromFile() {
  const input = document.getElementById('loadFileInput');
  input.click(); // Trigger file input click

  input.onchange = function(event) {
    const file = event.files[0];
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
        updateSummary(); // This will populate blessingTargetWeaponSelect
        document.getElementById('blessingTargetWeaponSelect').value = build.blessingTargetWeapon || 'None'; // Load selected target weapon
        document.getElementById('runemarkSelect').value = build.runemark || '';
        updateSummary(); // Final update
        const validationMessagesDiv = document.getElementById('validationMessages');
        validationMessagesDiv.innerHTML = '<p style="color: green;">Fighter build loaded from file!</p>';
      } catch (error) {
        const validationMessagesDiv = document.getElementById('validationMessages');
        validationMessagesDiv.innerHTML = '<p style="color: red;">Error loading file: Invalid JSON format.</p>';
        console.error('Error parsing loaded file:', error);
      }
    };
    reader.readAsText(file);
  };
}

/**
 * Exports the current fighter build to a PDF.
 */
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
