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
  initEventListeners();
  updateSummary();
}

/**
 * Initialize all event listeners
 */
function initEventListeners() {
  const elements = [
    'fighterSelect', 'factionSelect', 'archetypeSelect', 
    'primarySelect', 'secondarySelect', 'mountSelect', 
    'blessingSelect', 'blessingTargetWeaponSelect', 'runemarkSelect'
  ];
  
  elements.forEach(id => {
    document.getElementById(id).addEventListener('change', updateSummary);
  });
  
  document.getElementById('fighterNameInput').addEventListener('input', updateSummary);
}

/**
 * Fills a select element with options.
 * @param {string} elementId - The ID of the select element.
 * @param {Array<string>} options - An array of strings for the options.
 * @param {boolean} allowNone - Whether to include a 'None' option.
 */
function fillSelect(elementId, options, allowNone = true) {
  const select = document.getElementById(elementId);
  const currentValue = select.value;
  select.innerHTML = '';

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

  if (finalOptions.includes(currentValue)) {
    select.value = currentValue;
  } else if (allowNone) {
    select.value = 'None';
  } else if (finalOptions.length > 0) {
    select.value = finalOptions[0];
  }
}

/**
 * Retrieves the selected data object from a dataset based on the select element's value.
 */
function getSelectedData(elementId, dataset) {
  const select = document.getElementById(elementId);
  const selectedName = select.value;
  if (selectedName === 'None' || !selectedName) return null;

  if (elementId === 'primarySelect' || elementId === 'secondarySelect') {
    const actualName = selectedName.split(' (')[0];
    return dataset.find(item => item.name === actualName);
  }

  return dataset.find(item => item.name === selectedName);
}

/**
 * Updates the fighter summary based on current selections.
 */
function updateSummary() {
  const validationMessagesDiv = document.getElementById('validationMessages');
  validationMessagesDiv.innerHTML = '';
  let messages = [];

  const fighterNameInput = document.getElementById('fighterNameInput').value;
  document.getElementById('fighterName').textContent = fighterNameInput || 'Un-named Fighter';

  let currentPoints = 0;
  let currentFighter = { Mv: 0, T: 0, W: 0, R: 0, A: 0, S: 0, D: 0, C: 0 };
  let currentRunemarks = [];
  let currentFactionRunemark = 'None';

  const selectedFighter = processFighterSelection(currentFighter, currentRunemarks, currentPoints, messages);
  const selectedArchetype = processArchetypeSelection(selectedFighter, currentFighter, currentRunemarks, currentPoints, messages, currentFactionRunemark);
  const selectedPrimaryWeapon = processPrimaryWeaponSelection(selectedArchetype, currentPoints, messages);
  const selectedSecondaryWeapon = processSecondaryWeaponSelection(selectedArchetype, selectedPrimaryWeapon, currentFighter, currentPoints, messages);
  const selectedMount = processMountSelection(selectedFighter, currentFighter, currentRunemarks, currentPoints, messages);
  const selectedBlessing = processBlessingSelection(currentFighter, currentPoints, messages);
  const selectedRunemark = processRunemarkSelection(selectedMount, currentRunemarks, currentPoints, messages);

  const finalAttackProfiles = generateAttackProfiles(
    currentFighter, selectedArchetype, selectedPrimaryWeapon, 
    selectedSecondaryWeapon, selectedMount, rules, selectedRunemark
  );

  processBlessingTargetWeapon(selectedBlessing, finalAttackProfiles, currentFighter);
  applyBlessingWeaponEffects(selectedBlessing, finalAttackProfiles, messages);

  validateRunemarkLimit(currentRunemarks, rules, messages);
  validateAttackActionsLimit(finalAttackProfiles, rules, messages);

  updateDisplay(currentFighter, currentRunemarks, finalAttackProfiles, currentPoints, messages, validationMessagesDiv, selectedBlessing);
}

/**
 * Helper function to add validation messages with revert callback
 */
function addValidationMessage(messages, message, revertCallback = null) {
  messages.push(message);
  if (revertCallback) revertCallback();
  return true;
}

/**
 * Helper function to apply stat bonuses
 */
function applyStatBonuses(effects, currentFighter) {
  if (!effects) return;
  
  Object.keys(effects).forEach(key => {
    if (key.endsWith('Bonus')) {
      const statKey = key.replace('Bonus', '').charAt(0).toUpperCase() + 
                     key.replace('Bonus', '').slice(1);
      if (currentFighter[statKey] !== undefined) {
        currentFighter[statKey] += effects[key];
      }
    } else if (key === 'meleeAttackMin') {
      if (currentFighter.A < effects.meleeAttackMin) {
        currentFighter.A = effects.meleeAttackMin;
      }
    }
  });
}

/**
 * Helper function to create attack profile
 */
function createAttackProfile(baseProfile, source, currentFighter) {
  const profile = { ...baseProfile, range: [...baseProfile.range] };
  profile.name = source.name || baseProfile.name;
  
  const statMap = {
    "baseAttacks": currentFighter.A,
    "baseStrength": currentFighter.S, 
    "baseDamage": currentFighter.D,
    "baseCrit": currentFighter.C,
    "baseReach": currentFighter.R
  };
  
  profile.attacks = statMap[profile.attacks] || profile.attacks;
  profile.strength = statMap[profile.strength] || profile.strength;
  profile.damage = statMap[profile.damage] || profile.damage;
  profile.crit = statMap[profile.crit] || profile.crit;
  profile.range[1] = statMap[profile.range[1]] || profile.range[1];
  
  return profile;
}

/**
 * Helper function to format range display
 */
function formatRangeDisplay(profile, currentFighter) {
  const minRange = profile.range[0] === "baseReach" ? currentFighter.R : profile.range[0];
  const maxRange = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1];
  return minRange > 0 ? `${minRange}"-${maxRange}"` : `${maxRange}"`;
}

/**
 * Process fighter selection and update state
 */
function processFighterSelection(currentFighter, currentRunemarks, currentPoints, messages) {
  const selectedFighter = getSelectedData('fighterSelect', data.fighters);
  
  if (selectedFighter) {
    currentPoints += selectedFighter.points;
    Object.assign(currentFighter, JSON.parse(JSON.stringify(selectedFighter)));
    currentRunemarks.push(...selectedFighter.runemarks);
    
    fillSelect('factionSelect', selectedFighter.factionRunemarks, selectedFighter.factionRunemarks.length === 0);
    currentFactionRunemark = document.getElementById('factionSelect').value;
  } else {
    fillSelect('factionSelect', ['None'], true);
    currentFactionRunemark = 'None';
  }
  
  document.getElementById('fighterType').textContent = selectedFighter ? selectedFighter.name : '-';
  document.getElementById('factionRunemarkDisplay').textContent = currentFactionRunemark;
  
  return selectedFighter;
}

/**
 * Process archetype selection and update state
 */
function processArchetypeSelection(selectedFighter, currentFighter, currentRunemarks, currentPoints, messages, currentFactionRunemark) {
  let selectedArchetype = getSelectedData('archetypeSelect', data.archetypes);
  let archetypeInvalid = false;
  
  if (selectedArchetype && selectedFighter && selectedArchetype.restrictions) {
    if (selectedArchetype.restrictions.forbiddenFighters.includes(selectedFighter.name)) {
      archetypeInvalid = addValidationMessage(
        messages,
        `${selectedFighter.name} cannot be a ${selectedArchetype.name}. Reverting Archetype to Commander.`,
        () => { document.getElementById('archetypeSelect').value = 'Commander'; }
      );
    }
    
    if (!archetypeInvalid && selectedArchetype.restrictions.forbiddenFactions.includes(currentFactionRunemark)) {
      archetypeInvalid = addValidationMessage(
        messages,
        `${currentFactionRunemark} cannot have a ${selectedArchetype.name} Archetype. Reverting Archetype to Commander.`,
        () => { document.getElementById('archetypeSelect').value = 'Commander'; }
      );
    }
  }

  if (archetypeInvalid) {
    document.getElementById('archetypeSelect').value = 'Commander';
    selectedArchetype = data.archetypes.find(a => a.name === 'Commander');
  }

  if (selectedArchetype) {
    currentPoints += selectedArchetype.points;
    applyStatBonuses(selectedArchetype.fighterEffects, currentFighter);
    
    if (selectedArchetype.runemarksAdded) {
      selectedArchetype.runemarksAdded.forEach(rm => {
        if (!currentRunemarks.includes(rm)) currentRunemarks.push(rm);
      });
    }
  }
  
  return selectedArchetype;
}

/**
 * Process primary weapon selection and update state
 */
function processPrimaryWeaponSelection(selectedArchetype, currentPoints, messages) {
  let selectedPrimaryWeapon = getSelectedData('primarySelect', data.primaryWeapons);
  let primaryWeaponInvalid = false;

  if (selectedArchetype && selectedArchetype.restrictions && selectedArchetype.restrictions.mustUseOneHandedPrimary) {
    if (selectedPrimaryWeapon && selectedPrimaryWeapon.handedness !== 'one') {
      primaryWeaponInvalid = addValidationMessage(
        messages,
        `${selectedArchetype.name} Archetype requires a one-handed primary weapon. Reverting Primary Weapon.`,
        () => { 
          const defaultPrimary = data.primaryWeapons.find(w => w.name === 'Hand Weapon') || data.primaryWeapons[0];
          document.getElementById('primarySelect').value = `${defaultPrimary.name} (${defaultPrimary.handedness.charAt(0).toUpperCase() + defaultPrimary.handedness.slice(1)}-handed)`;
        }
      );
    }
  }

  if (primaryWeaponInvalid) {
    const defaultPrimary = data.primaryWeapons.find(w => w.name === 'Hand Weapon') || data.primaryWeapons[0];
    document.getElementById('primarySelect').value = `${defaultPrimary.name} (${defaultPrimary.handedness.charAt(0).toUpperCase() + defaultPrimary.handedness.slice(1)}-handed)`;
    selectedPrimaryWeapon = defaultPrimary;
  }

  if (selectedPrimaryWeapon) {
    currentPoints += selectedPrimaryWeapon.points;
  }

  return selectedPrimaryWeapon;
}

/**
 * Process secondary weapon selection and update state
 */
function processSecondaryWeaponSelection(selectedArchetype, selectedPrimaryWeapon, currentFighter, currentPoints, messages) {
  const availableSecondaryWeapons = [];
  if (selectedPrimaryWeapon && selectedPrimaryWeapon.handedness === 'one') {
    availableSecondaryWeapons.push(...data.secondaryWeapons.map(w => w.name));
  }
  fillSelect('secondarySelect', availableSecondaryWeapons, true);

  let selectedSecondaryWeapon = getSelectedData('secondarySelect', data.secondaryWeapons);
  let secondaryWeaponInvalid = false;

  if (selectedArchetype && selectedArchetype.restrictions && selectedArchetype.restrictions.forbidSecondaryEquipment) {
    if (selectedSecondaryWeapon) {
      secondaryWeaponInvalid = addValidationMessage(
        messages,
        `${selectedArchetype.name} Archetype forbids secondary equipment. Reverting Secondary Equipment.`,
        () => { document.getElementById('secondarySelect').value = 'None'; }
      );
    }
  }

  if (secondaryWeaponInvalid) {
    document.getElementById('secondarySelect').value = 'None';
    selectedSecondaryWeapon = null;
  }

  if (selectedSecondaryWeapon) {
    currentPoints += selectedSecondaryWeapon.points;
    applyStatBonuses(selectedSecondaryWeapon.fighterEffects, currentFighter);
  }

  return selectedSecondaryWeapon;
}

/**
 * Process mount selection and update state
 */
function processMountSelection(selectedFighter, currentFighter, currentRunemarks, currentPoints, messages) {
  let selectedMount = getSelectedData('mountSelect', data.mounts);
  let mountInvalid = false;
  
  if (selectedMount && selectedFighter && selectedMount.restrictions && selectedMount.restrictions.forbiddenFighters.includes(selectedFighter.name)) {
    mountInvalid = addValidationMessage(
      messages,
      `${selectedFighter.name} cannot take a ${selectedMount.name}. Reverting Mount.`,
      () => { document.getElementById('mountSelect').value = 'None'; }
    );
  }

  if (mountInvalid) {
    document.getElementById('mountSelect').value = 'None';
    selectedMount = null;
  }

  if (selectedMount) {
    currentPoints += selectedMount.points;
    applyStatBonuses(selectedMount.fighterEffects, currentFighter);

    if (selectedMount.restrictions && selectedMount.restrictions.maxMovement && currentFighter.Mv > selectedMount.restrictions.maxMovement) {
      currentFighter.Mv = selectedMount.restrictions.maxMovement;
    }

    if (selectedMount.runemarksAdded) {
      selectedMount.runemarksAdded.forEach(rm => {
        if (!(rm === "Mounted" && selectedMount.restrictions.noMountedRunemarkFor && 
              selectedFighter && selectedMount.restrictions.noMountedRunemarkFor.includes(selectedFighter.name))) {
          if (!currentRunemarks.includes(rm)) {
            currentRunemarks.push(rm);
          }
        }
      });
    }
  }

  return selectedMount;
}

/**
 * Process blessing selection and update state
 */
function processBlessingSelection(currentFighter, currentPoints, messages) {
  const selectedBlessing = getSelectedData('blessingSelect', data.divineBlessings);
  
  if (selectedBlessing) {
    const pointsKey = currentFighter.W < 23 ? 'pointsLow' : 'pointsHigh';
    currentPoints += selectedBlessing[pointsKey];
    applyStatBonuses(selectedBlessing.fighterEffects, currentFighter);
  }
  
  return selectedBlessing;
}

/**
 * Process runemark selection and update state
 */
function processRunemarkSelection(selectedMount, currentRunemarks, currentPoints, messages) {
  let availableRunemarks = data.extraRunemarks.map(r => r.name).filter(rm => !currentRunemarks.includes(rm));
  fillSelect('runemarkSelect', availableRunemarks, true);

  let selectedRunemark = getSelectedData('runemarkSelect', data.extraRunemarks);
  let runemarkInvalid = false;
  
  if (selectedRunemark) {
    if (selectedRunemark.name === 'Fly' && selectedMount) {
      runemarkInvalid = addValidationMessage(
        messages,
        `Cannot select 'Fly' runemark if the fighter is mounted. Reverting Additional Runemark.`,
        () => { document.getElementById('runemarkSelect').value = 'None'; }
      );
    }
    
    if (!runemarkInvalid && selectedRunemark.restrictions && selectedRunemark.restrictions.cannotBeMounted && selectedMount) {
      runemarkInvalid = addValidationMessage(
        messages,
        `${selectedRunemark.name} runemark cannot be taken by a mounted fighter. Reverting Additional Runemark.`,
        () => { document.getElementById('runemarkSelect').value = 'None'; }
      );
    }
  }

  if (runemarkInvalid) {
    document.getElementById('runemarkSelect').value = 'None';
    selectedRunemark = null;
  }

  if (selectedRunemark && !currentRunemarks.includes(selectedRunemark.name)) {
    currentPoints += selectedRunemark.points;
    currentRunemarks.push(selectedRunemark.name);
  }

  return selectedRunemark;
}

/**
 * Generate all attack profiles for the fighter
 */
function generateAttackProfiles(currentFighter, selectedArchetype, selectedPrimaryWeapon, selectedSecondaryWeapon, selectedMount, rules, selectedRunemark) {
  let profiles = [];
  
  // Add unarmed profile
  profiles.push({
    name: "Unarmed",
    range: [0, 1],
    attacks: Math.max(currentFighter.A + (rules.unarmedPenalties.attackPenalty || 0), rules.unarmedPenalties.minimumValues.attacks),
    strength: currentFighter.S,
    damage: Math.max(currentFighter.D + (rules.unarmedPenalties.damagePenalty || 0), rules.unarmedPenalties.minimumValues.damage),
    crit: Math.max(currentFighter.C + (rules.unarmedPenalties.critPenalty || 0), rules.unarmedPenalties.minimumValues.crit),
    weaponRunemark: "Fist"
  });

  // Add profiles from various sources
  const sources = [
    { item: selectedPrimaryWeapon, type: 'weapon' },
    { item: selectedSecondaryWeapon, type: 'weapon' },
    { item: selectedArchetype, type: 'archetype' },
    { item: selectedMount, type: 'mount' }
  ];

  sources.forEach(({ item, type }) => {
    if (item && item.profile) {
      const profile = createAttackProfile(item.profile, item, currentFighter);
      
      // Apply weapon effects for weapons
      if (type === 'weapon' && item.effects) {
        profile.range[1] += (item.effects.rangeBonus || 0);
        profile.attacks += (item.effects.attackBonus || 0);
        profile.strength += (item.effects.strengthBonus || 0);
        profile.damage += (item.effects.damageBonus || 0);
        profile.crit += (item.effects.critBonus || 0);
      }
      
      profiles.push(profile);
    }
  });

  // Remove unarmed if melee weapons are present
  const hasMeleeWeapon = profiles.some(profile => 
    profile.name !== "Unarmed" && 
    (profile.range[0] === 0 || (profile.range[0] === "baseReach" && currentFighter.R === 0))
  );
  
  if (hasMeleeWeapon) {
    profiles = profiles.filter(p => p.name !== "Unarmed");
  }

  return profiles;
}

/**
 * Process blessing target weapon selection
 */
function processBlessingTargetWeapon(selectedBlessing, finalAttackProfiles, currentFighter) {
  const blessingTargetWeaponSelect = document.getElementById('blessingTargetWeaponSelect');
  let eligibleTargetWeapons = [];

  if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect) {
    eligibleTargetWeapons = finalAttackProfiles.filter(profile => {
      const minRangeResolved = profile.range[0] === "baseReach" ? currentFighter.R : profile.range[0];
      const maxRangeResolved = profile.range[1] === "baseReach" ? currentFighter.R : profile.range[1];
      const isMeleeForBlessing = (minRangeResolved === 0) && (maxRangeResolved <= 3);

      return (selectedBlessing.targetProfile === "melee" && isMeleeForBlessing) ||
             (selectedBlessing.targetProfile === "any");
    }).map(profile => profile.name);
  }

  fillSelect('blessingTargetWeaponSelect', eligibleTargetWeapons, true);
  blessingTargetWeaponSelect.disabled = !(selectedBlessing && selectedBlessing.targetable && eligibleTargetWeapons.length > 0);
}

/**
 * Apply blessing weapon effects to target weapon
 */
function applyBlessingWeaponEffects(selectedBlessing, finalAttackProfiles, messages) {
  const selectedTargetWeaponName = document.getElementById('blessingTargetWeaponSelect').value;
  const targetWeaponProfile = finalAttackProfiles.find(p => p.name === selectedTargetWeaponName);

  if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect && targetWeaponProfile) {
    targetWeaponProfile.attacks = (targetWeaponProfile.attacks || 0) + (selectedBlessing.weaponEffect.attackBonus || 0);
    targetWeaponProfile.strength = (targetWeaponProfile.strength || 0) + (selectedBlessing.weaponEffect.strengthBonus || 0);
    targetWeaponProfile.damage = (targetWeaponProfile.damage || 0) + (selectedBlessing.weaponEffect.damageBonus || 0);
    targetWeaponProfile.crit = (targetWeaponProfile.crit || 0) + (selectedBlessing.weaponEffect.critBonus || 0);
  } else if (selectedBlessing && selectedBlessing.targetable && selectedBlessing.weaponEffect && !targetWeaponProfile && 
             document.getElementById('blessingTargetWeaponSelect').options.length > 1) {
    messages.push(`Please select a target weapon for the '${selectedBlessing.name}' Divine Blessing.`);
  }
}

/**
 * Validate runemark limit
 */
function validateRunemarkLimit(currentRunemarks, rules, messages) {
  if (currentRunemarks.length > rules.maxRunemarks) {
    messages.push(`A fighter can have a maximum of ${rules.maxRunemarks} runemarks. Please adjust your selections.`);
  }
}

/**
 * Validate attack actions limit
 */
function validateAttackActionsLimit(finalAttackProfiles, rules, messages) {
  if (finalAttackProfiles.length > rules.maxAttackActions) {
    messages.push(`A fighter can have a maximum of ${rules.maxAttackActions} attack actions. Please adjust your equipment selections.`);
  }
}

/**
 * Update the display with current fighter data
 */
function updateDisplay(currentFighter, currentRunemarks, finalAttackProfiles, currentPoints, messages, validationMessagesDiv, selectedBlessing) {
  document.getElementById('statMv').textContent = currentFighter.Mv;
  document.getElementById('statT').textContent = currentFighter.T;
  document.getElementById('statW').textContent = currentFighter.W;

  document.getElementById('runemarkDisplay').textContent = currentRunemarks.length > 0 ? currentRunemarks.join(', ') : 'None';

  const blessingEffectText = selectedBlessing ? 
    `${selectedBlessing.name} - ${selectedBlessing.description || selectedBlessing.specialEffect || ''}` : 
    'None';
  document.getElementById('blessingEffect').textContent = blessingEffectText;

  const attackProfilesUl = document.getElementById('attackProfiles');
  attackProfilesUl.innerHTML = '';
  
  if (finalAttackProfiles.length > 0) {
    finalAttackProfiles.forEach(profile => {
      const li = document.createElement('li');
      const rangeDisplay = formatRangeDisplay(profile, currentFighter);
      li.textContent = `${profile.name}: Range ${rangeDisplay}, Attacks ${profile.attacks}, Strength ${profile.strength}, Damage/Crit ${profile.damage}/${profile.crit}, Runemark: ${profile.weaponRunemark}`;
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
  fillSelect('fighterSelect', data.fighters.map(f => f.name), false);
  if (data.fighters.length > 0) {
    document.getElementById('fighterSelect').value = data.fighters[0].name;
  }

  fillSelect('archetypeSelect', data.archetypes.map(a => a.name), false);
  fillSelect('mountSelect', data.mounts.map(m => m.name), true);
  fillSelect('runemarkSelect', data.extraRunemarks.map(r => r.name), true);

  const primaryWeaponOptions = data.primaryWeapons.map(w => `${w.name} (${w.handedness.charAt(0).toUpperCase() + w.handedness.slice(1)}-handed)`);
  fillSelect('primarySelect', primaryWeaponOptions, true);
  document.getElementById('primarySelect').value = primaryWeaponOptions.includes('Hand Weapon (One-handed)') ? 'Hand Weapon (One-handed)' : primaryWeaponOptions[0];

  fillSelect('secondarySelect', [], true);
  fillSelect('blessingSelect', data.divineBlessings.map(b => b.name), true);
  fillSelect('blessingTargetWeaponSelect', [], true);
}

// The remaining functions (saveBuild, loadBuildFromFile, parseAndApplyBuild, exportTextSummary, exportBuildPDF) 
// remain exactly the same as in your original code...

function saveBuild() {
  const selections = {};
  ['fighter', 'faction', 'archetype', 'primary', 'secondary', 'mount', 'blessing', 'blessingTargetWeapon', 'runemark'].forEach(key => {
    selections[key] = document.getElementById(`${key}Select`).value;
  });
  selections.fighterName = document.getElementById('fighterNameInput').value || '';
  localStorage.setItem('warcryBuild', JSON.stringify(selections));

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
    'BlessingTargetWeapon': 'blessingTargetWeaponSelect',
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
BlessingTargetWeapon: ${document.getElementById('blessingTargetWeaponSelect').value}
Extra Runemark: ${document.getElementById('runemarkSelect').value}
Total Points: ${document.getElementById('pointsTotal').textContent}`;
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
