const files = [
  'fighters.json', 'archetypes.json', 'primaryWeapons.json',
  'secondaryWeapons.json', 'mounts.json', 'divineBlessings.json',
  'extraRunemarks.json', 'rules.json'
];

const data = {};
let rules = {}; // Global rules object

// Helper function to get a deep copy of a profile to avoid modifying original data
function deepCopyProfile(profile) {
    if (!profile) return null;
    return JSON.parse(JSON.stringify(profile));
}

// Function to resolve "baseX" placeholders in weapon profiles
// Now uses currentFighterStats to reflect any applied archetype/mount bonuses
function resolvePlaceholders(profile, currentFighterStats) {
    if (!profile) return null;
    const resolvedProfile = deepCopyProfile(profile);

    if (Array.isArray(resolvedProfile.range)) {
        resolvedProfile.range = resolvedProfile.range.map(r => r === "baseReach" ? currentFighterStats.R : r);
    }
    if (resolvedProfile.attacks === "baseAttacks") {
        resolvedProfile.attacks = currentFighterStats.A;
    }
    if (resolvedProfile.strength === "baseStrength") {
        resolvedProfile.strength = currentFighterStats.S;
    }
    if (resolvedProfile.damage === "baseDamage") {
        resolvedProfile.damage = currentFighterStats.D;
    }
    if (resolvedProfile.crit === "baseCrit") {
        resolvedProfile.crit = currentFighterStats.C;
    }
    return resolvedProfile;
}

// Helper function to apply effects to an attack profile
function applyEffectsToProfile(profile, effects) {
    if (!profile || !effects) return profile;
    const modifiedProfile = deepCopyProfile(profile); // Ensure we're modifying a copy
    if (effects.rangeBonus !== undefined) modifiedProfile.range[1] = (modifiedProfile.range[1] || 0) + effects.rangeBonus;
    if (effects.attackBonus !== undefined) modifiedProfile.attacks = Math.max(1, modifiedProfile.attacks + effects.attackBonus);
    if (effects.strengthBonus !== undefined) modifiedProfile.strength = Math.max(1, modifiedProfile.strength + effects.strengthBonus);
    if (effects.damageBonus !== undefined) modifiedProfile.damage = Math.max(1, modifiedProfile.damage + effects.damageBonus);
    if (effects.critBonus !== undefined) modifiedProfile.crit = Math.max(1, modifiedProfile.crit + effects.critBonus);
    return modifiedProfile;
}


async function init() {
  for (const file of files) {
    try {
      const res = await fetch(`data/${file}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${file}: ${res.statusText}`);
      }
      data[file.replace('.json', '')] = await res.json();
    } catch (error) {
      console.error(`Error loading data file ${file}:`, error);
      document.getElementById('validationMessages').textContent = `Error loading data: ${file}. Please check console for details.`;
      return; // Stop initialization if a critical file fails to load
    }
  }
  rules = data.rules; // Assign rules globally
  populateSelections();
  // Initial call to updateSummary after data is loaded and selections are populated
  updateSummary();
}

function fillSelect(selectId, options) {
  const select = document.getElementById(selectId);
  select.innerHTML = ''; // Clear existing options
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

function updateSummary() {
  const fighterNameInput = document.getElementById('fighterNameInput').value;
  const selectedFighterName = document.getElementById('fighterSelect').value;
  const selectedFactionName = document.getElementById('factionSelect').value;
  const selectedArchetypeName = document.getElementById('archetypeSelect').value;
  const selectedPrimaryWeapon = document.getElementById('primarySelect').value;
  const selectedSecondaryWeapon = document.getElementById('secondarySelect').value;
  const selectedMount = document.getElementById('mountSelect').value;
  const selectedBlessing = document.getElementById('blessingSelect').value;
  const selectedRunemark = document.getElementById('runemarkSelect').value;

  const fighterNameDisplay = document.getElementById('fighterName');
  const fighterTypeDisplay = document.getElementById('fighterType');
  const factionRunemarkDisplay = document.getElementById('factionRunemarkDisplay');
  const runemarkDisplay = document.getElementById('runemarkDisplay');
  const statMv = document.getElementById('statMv');
  const statT = document.getElementById('statT');
  const statW = document.getElementById('statW');
  const attackProfilesUl = document.getElementById('attackProfiles');
  const blessingEffect = document.getElementById('blessingEffect');
  const pointsTotal = document.getElementById('pointsTotal');
  const validationMessages = document.getElementById('validationMessages');

  // Clear previous validation messages
  validationMessages.textContent = '';

  let currentFighter = {};
  let totalPoints = 0;
  let currentRunemarks = new Set();
  let currentFactionRunemarks = new Set();

  // 1. Choose a Base Fighter
  const baseFighter = data.fighters.find(f => f.name === selectedFighterName);
  if (!baseFighter) {
    validationMessages.textContent = 'Please select a valid fighter type.';
    return;
  }

  currentFighter = deepCopyProfile(baseFighter); // Start with a copy of base fighter stats
  totalPoints += baseFighter.points;
  baseFighter.runemarks.forEach(r => currentRunemarks.add(r));

  // Populate Faction Runemarks dynamically based on selected base fighter
  const factionSelect = document.getElementById('factionSelect');
  fillSelect('factionSelect', baseFighter.factionRunemarks);
  if (baseFighter.factionRunemarks.includes(selectedFactionName)) {
    factionSelect.value = selectedFactionName; // Keep current if valid
  } else {
    factionSelect.value = baseFighter.factionRunemarks[0] || ''; // Default to first
  }
  if (factionSelect.value) {
    currentFactionRunemarks.add(factionSelect.value);
  }

  // 2. Choose an Archetype
  const archetypeData = data.archetypes.find(a => a.name === selectedArchetypeName);
  if (archetypeData) {
    totalPoints += archetypeData.points;
    archetypeData.runemarksAdded.forEach(r => currentRunemarks.add(r));

    // Apply Archetype fighter effects (e.g., Mage's meleeAttackBonus)
    if (archetypeData.fighterEffects) {
        if (archetypeData.fighterEffects.meleeAttackBonus) {
            currentFighter.A = Math.max(archetypeData.fighterEffects.meleeAttackMin || 1, currentFighter.A + archetypeData.fighterEffects.meleeAttackBonus);
        }
    }

    // Apply Archetype restrictions to weapon selection
    const primarySelectElement = document.getElementById('primarySelect');
    const secondarySelectElement = document.getElementById('secondarySelect');
    
    let availablePrimaryWeapons = data.primaryWeapons;
    if (archetypeData.restrictions.mustUseOneHandedPrimary) {
        availablePrimaryWeapons = data.primaryWeapons.filter(w => w.handedness === 'one');
        // Ensure 'Hand Weapon' is always an option if it's one-handed
        if (!availablePrimaryWeapons.some(w => w.name === 'Hand Weapon')) {
             availablePrimaryWeapons.unshift(data.primaryWeapons.find(w => w.name === 'Hand Weapon'));
        }
        if (!availablePrimaryWeapons.some(w => w.name === selectedPrimaryWeapon.split(' (')[0])) {
            primarySelectElement.value = 'Hand Weapon (One-handed)'; // Default to Hand Weapon if current invalid
        }
    }
    fillSelect('primarySelect', availablePrimaryWeapons.map(w => `${w.name} (${w.handedness.charAt(0).toUpperCase() + w.handedness.slice(1)}-handed)`));

    if (archetypeData.restrictions.forbidSecondaryEquipment) {
        secondarySelectElement.value = 'None';
        secondarySelectElement.disabled = true;
    } else {
        secondarySelectElement.disabled = false;
    }
  }

  // Recalculate based on possibly updated selected primary/secondary after restrictions
  const primaryWeaponDisplayName = document.getElementById('primarySelect').value;
  const primaryWeaponName = primaryWeaponDisplayName.split(' (')[0];
  const primaryWeaponData = data.primaryWeapons.find(w => w.name === primaryWeaponName);

  const secondaryWeaponName = document.getElementById('secondarySelect').value;
  const secondaryWeaponData = data.secondaryWeapons.find(w => w.name === secondaryWeaponName);

  // --- Attack Profile Collection ---
  const rawAttackProfiles = []; // Temporary array to collect all profiles from selections

  // 1. Process Primary Weapon
  if (primaryWeaponData) { // primaryWeaponData will always exist because fillSelect ensures a selection
      totalPoints += primaryWeaponData.points;
      if (primaryWeaponData.profile) {
          let primaryProfile = resolvePlaceholders(primaryWeaponData.profile, currentFighter);
          primaryProfile.name = primaryWeaponData.name;
          if (primaryWeaponData.effects) {
              primaryProfile = applyEffectsToProfile(primaryProfile, primaryWeaponData.effects);
          }
          rawAttackProfiles.push(primaryProfile);
      }
      // Note: Primary weapon 'fighterEffects' like 'unarmedInMelee' are implicitly handled
      // by the final check for 0-min-range profiles, as these weapons provide ranged profiles.
  }

  // 2. Process Secondary Equipment
  if (secondaryWeaponData && secondaryWeaponName !== 'None') {
      totalPoints += secondaryWeaponData.points;
      if (secondaryWeaponData.profile) {
          let secondaryProfile = resolvePlaceholders(secondaryWeaponData.profile, currentFighter);
          secondaryProfile.name = secondaryWeaponData.name;
          if (secondaryWeaponData.effects) {
              secondaryProfile = applyEffectsToProfile(secondaryProfile, secondaryWeaponData.effects);
          }
          rawAttackProfiles.push(secondaryProfile);
      }
      if (secondaryWeaponData.fighterEffects) {
          if (secondaryWeaponData.fighterEffects.toughnessBonus) {
              currentFighter.T += secondaryWeaponData.fighterEffects.toughnessBonus;
          }
      }
  }

  // 3. Process Mount
  const mountData = data.mounts.find(m => m.name === selectedMount);
  if (mountData && selectedMount !== 'None') {
    totalPoints += mountData.points;
    // Apply mount fighter effects
    if (mountData.fighterEffects) {
      if (mountData.fighterEffects.movementBonus) {
        currentFighter.Mv += mountData.fighterEffects.movementBonus;
        // Enforce max movement from mount restrictions
        if (mountData.restrictions && mountData.restrictions.maxMovement) {
            currentFighter.Mv = Math.min(currentFighter.Mv, mountData.restrictions.maxMovement);
        }
      }
      if (mountData.fighterEffects.woundsBonus) {
        currentFighter.W += mountData.fighterEffects.woundsBonus;
      }
      if (mountData.fighterEffects.attackBonus) { // Apply to currentFighter's base attacks
        currentFighter.A += mountData.fighterEffects.attackBonus;
      }
    }
    // Add mount runemark, respecting exceptions
    let addMountedRunemark = true;
    if (mountData.restrictions && mountData.restrictions.noMountedRunemarkFor) {
        if (mountData.restrictions.noMountedRunemarkFor.includes(baseFighter.name)) { // Check baseFighter name
            addMountedRunemark = false;
        }
    }
    if (addMountedRunemark) {
        mountData.runemarksAdded.forEach(r => currentRunemarks.add(r));
    }
    
    // Add mount's attack profile if it has one
    if (mountData.profile) {
        let mountProfile = resolvePlaceholders(mountData.profile, currentFighter);
        mountProfile.name = mountData.name;
        // No 'effects' property for mounts in JSON as per my observation, so no applyEffectsToProfile call here
        rawAttackProfiles.push(mountProfile);
    }
  }

  // 4. Process Archetype's specific attack profile (e.g., Mage's Arcane Bolt)
  if (archetypeData && archetypeData.profile) {
    // Archetype profiles don't typically use "baseX" placeholders, but deep copy for safety.
    let archetypeProfile = deepCopyProfile(archetypeData.profile);
    archetypeProfile.name = archetypeData.name; // Use archetype name as weapon name for clarity
    rawAttackProfiles.push(archetypeProfile);
  }

  // --- Final Attack Profiles Determination ---
  const finalAttackProfiles = [];
  let hasAnyZeroMinRangeProfile = false;

  // First, check if any of the collected profiles has a minimum range of 0
  if (rawAttackProfiles.some(p => p.range[0] === 0)) {
      hasAnyZeroMinRangeProfile = true;
  }

  // If no explicit 0-min-range weapon was found, add the Unarmed Melee profile
  if (!hasAnyZeroMinRangeProfile) {
      const unarmedProfile = {
          name: "Unarmed Melee",
          range: [0, currentFighter.R], // Use modified currentFighter.R for unarmed range
          attacks: Math.max(rules.unarmedPenalties.minimumValues.attacks, currentFighter.A + rules.unarmedPenalties.attackPenalty),
          strength: Math.max(rules.unarmedPenalties.minimumValues.strength, currentFighter.S + rules.unarmedPenalties.strengthPenalty),
          damage: Math.max(rules.unarmedPenalties.minimumValues.damage, currentFighter.D + rules.unarmedPenalties.damagePenalty),
          crit: Math.max(rules.unarmedPenalties.minimumValues.crit, currentFighter.C + rules.unarmedPenalties.critPenalty),
          weaponRunemark: ""
      };
      finalAttackProfiles.push(unarmedProfile); // Push first to keep it at the top
  }

  // Now add all other potential attack profiles from rawAttackProfiles
  rawAttackProfiles.forEach(profile => finalAttackProfiles.push(profile));

  // 5. Divine Blessing
  const blessingData = data.divineBlessings.find(b => b.name === selectedBlessing);
  blessingEffect.textContent = 'None'; // Reset display
  if (blessingData && selectedBlessing !== 'None') {
    totalPoints += (currentFighter.W < 23 ? blessingData.pointsLow : blessingData.pointsHigh);
    blessingEffect.textContent = blessingData.description || blessingData.specialEffect || blessingData.name;

    // Apply fighter effects from blessing (e.g., Swiftness, Resilience, Fortitude)
    if (blessingData.fighterEffects) {
      if (blessingData.fighterEffects.movementBonus) {
        currentFighter.Mv += blessingData.fighterEffects.movementBonus;
        // Re-apply mount movement cap after blessing if a mount is present
        if (mountData && mountData.restrictions && mountData.restrictions.maxMovement) {
            currentFighter.Mv = Math.min(currentFighter.Mv, mountData.restrictions.maxMovement);
        }
      }
      if (blessingData.fighterEffects.toughnessBonus) {
        currentFighter.T += blessingData.fighterEffects.toughnessBonus;
      }
      if (blessingData.fighterEffects.woundsBonus) {
        currentFighter.W += blessingData.fighterEffects.woundsBonus;
      }
    }

    // Apply Divine Blessing weapon effects to the first suitable profile
    if (blessingData.weaponEffect) {
        const targetProfileType = blessingData.targetProfile; // "melee" or "any"
        for (const profile of finalAttackProfiles) {
            // Ensure profile has attributes to modify and is a valid target
            if (profile.attacks !== undefined) {
                if (targetProfileType === "any" || (targetProfileType === "melee" && profile.range[0] === 0)) {
                    profile.attacks = Math.max(1, profile.attacks + (blessingData.weaponEffect.attackBonus || 0));
                    profile.strength = Math.max(1, profile.strength + (blessingData.weaponEffect.strengthBonus || 0));
                    profile.damage = Math.max(1, profile.damage + (blessingData.weaponEffect.damageBonus || 0));
                    profile.crit = Math.max(1, profile.crit + (blessingData.weaponEffect.critBonus || 0));
                    break; // Apply to the first eligible weapon found
                }
            }
        }
    }
  }

  // 6. Additional Runemark
  const extraRunemarkData = data.extraRunemarks.find(r => r.name === selectedRunemark);
  if (extraRunemarkData && selectedRunemark !== 'None') {
    // Check max runemarks before adding
    if (currentRunemarks.size >= rules.maxRunemarks) {
        validationMessages.textContent += `Cannot add "${extraRunemarkData.name}" runemark: Maximum of ${rules.maxRunemarks} runemarks already reached.`;
        document.getElementById('runemarkSelect').value = 'None'; // Reset selection
    } else {
        currentRunemarks.add(extraRunemarkData.name);
        totalPoints += extraRunemarkData.points;
    }
  }

  // Ensure unique profiles are added. Use a Set to track identifiers.
  const uniqueFinalAttackProfiles = [];
  const seenProfiles = new Set();
  finalAttackProfiles.forEach(profile => {
      // Create a unique identifier for each profile based on name, range, and core stats
      const profileIdentifier = `${profile.name}-${profile.range[0]}-${profile.range[1]}-${profile.attacks}-${profile.strength}-${profile.damage}-${profile.crit}-${profile.weaponRunemark}`;
      if (!seenProfiles.has(profileIdentifier)) {
          uniqueFinalAttackProfiles.push(profile);
          seenProfiles.add(profileIdentifier);
      }
  });

  // Sort profiles for consistent display: Unarmed first, then melee, then ranged, then others
  uniqueFinalAttackProfiles.sort((a, b) => {
      if (a.name === "Unarmed Melee") return -1;
      if (b.name === "Unarmed Melee") return 1;
      // Simple sort by min range, then max range
      if (a.range[0] !== b.range[0]) return a.range[0] - b.range[0];
      if (a.range[1] !== b.range[1]) return a.range[1] - b.range[1];
      return a.name.localeCompare(b.name); // Alphabetical for same type/range
  });

  // Display Stats
  fighterNameDisplay.textContent = fighterNameInput || '-';
  fighterTypeDisplay.textContent = baseFighter.name;
  factionRunemarkDisplay.textContent = Array.from(currentFactionRunemarks).join(', ') || '-';
  runemarkDisplay.textContent = Array.from(currentRunemarks).join(', ') || '-';
  statMv.textContent = currentFighter.Mv;
  statT.textContent = currentFighter.T;
  statW.textContent = currentFighter.W;

  // Update Attack Profiles display
  attackProfilesUl.innerHTML = '';
  if (uniqueFinalAttackProfiles.length === 0) {
      const li = document.createElement('li');
      li.textContent = `No attack profiles available.`;
      attackProfilesUl.appendChild(li);
  } else {
    // Check max attack actions after collecting all unique profiles
    if (uniqueFinalAttackProfiles.length > rules.maxAttackActions) {
        validationMessages.textContent += `Cannot select these options: Exceeds maximum of ${rules.maxAttackActions} attack actions.`;
    }
    uniqueFinalAttackProfiles.forEach(profile => {
      const li = document.createElement('li');
      const rangeText = profile.range[0] === 0 ? `${profile.range[1]}"` : `${profile.range[0]}-${profile.range[1]}"`;
      li.textContent = `${profile.name}: Rng ${rangeText}, A ${profile.attacks}, S ${profile.strength}, D ${profile.damage}/${profile.crit}`;
      if (profile.weaponRunemark) {
        li.textContent += `, Runemark: ${profile.weaponRunemark}`;
      }
      attackProfilesUl.appendChild(li);
    });
  }

  pointsTotal.textContent = totalPoints;
}

// Save/Load functionality (retained)
function saveBuild() {
  const build = {
    fighterName: document.getElementById('fighterNameInput').value,
    fighterType: document.getElementById('fighterSelect').value,
    factionRunemark: document.getElementById('factionSelect').value,
    archetype: document.getElementById('archetypeSelect').value,
    primaryWeapon: document.getElementById('primarySelect').value,
    secondaryWeapon: document.getElementById('secondarySelect').value,
    mount: document.getElementById('mountSelect').value,
    blessing: document.getElementById('blessingSelect').value,
    runemark: document.getElementById('runemarkSelect').value
  };
  // Using custom message box instead of alert
  showMessage('Build saved to local storage!');
  localStorage.setItem('warcryFighterBuild', JSON.stringify(build));
}

function loadBuild() {
  const savedBuild = localStorage.getItem('warcryFighterBuild');
  if (savedBuild) {
    const build = JSON.parse(savedBuild);
    document.getElementById('fighterNameInput').value = build.fighterName;
    document.getElementById('fighterSelect').value = build.fighterType;
    document.getElementById('factionSelect').value = build.factionRunemark;
    document.getElementById('archetypeSelect').value = build.archetype;
    document.getElementById('primarySelect').value = build.primaryWeapon;
    document.getElementById('secondarySelect').value = build.secondaryWeapon;
    document.getElementById('mountSelect').value = build.mount;
    document.getElementById('blessingSelect').value = build.blessing;
    document.getElementById('runemarkSelect').value = build.runemark;

    updateSummary(); // Re-calculate and display
    // Using custom message box instead of alert
    showMessage('Build loaded from local storage!');
  } else {
    showMessage('No saved build found.');
  }
}

function loadBuildFromFile() {
  const input = document.getElementById('loadFileInput');
  input.click(); // Trigger the file input click
}

document.getElementById('loadFileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const build = JSON.parse(e.target.result);
        // Set values and trigger update
        document.getElementById('fighterNameInput').value = build.fighterName || '';
        document.getElementById('fighterSelect').value = build.fighterType || '';
        document.getElementById('factionSelect').value = build.factionRunemark || '';
        document.getElementById('archetypeSelect').value = build.archetype || '';
        document.getElementById('primarySelect').value = build.primaryWeapon || '';
        document.getElementById('secondarySelect').value = build.secondaryWeapon || '';
        document.getElementById('mountSelect').value = build.mount || '';
        document.getElementById('blessingSelect').value = build.blessing || '';
        document.getElementById('runemarkSelect').value = build.runemark || '';
        
        updateSummary();
        showMessage('Build loaded from file!');
      } catch (error) {
        showMessage('Error parsing file: Invalid JSON format.');
        console.error('Error parsing load file:', error);
      }
    };
    reader.readAsText(file);
  }
});

// Custom Message Box (replacement for alert)
function showMessage(message) {
    let msgBox = document.getElementById('customMessageBox');
    if (!msgBox) {
        msgBox = document.createElement('div');
        msgBox.id = 'customMessageBox';
        msgBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #333;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            text-align: center;
            font-family: 'Inter', sans-serif;
        `;
        document.body.appendChild(msgBox);
    }
    msgBox.textContent = message;
    msgBox.style.display = 'block';

    setTimeout(() => {
        msgBox.style.display = 'none';
    }, 3000); // Hide after 3 seconds
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
    pdf.text(`- ${li.textContent}`, 15, y);
    y += 7;
  });
  y += 5;

  pdf.setFontSize(12);
  pdf.text(`Divine Blessing: ${blessingEffect}`, 10, y);
  y += 7;

  pdf.setFontSize(14);
  pdf.text(`Total Points: ${totalPoints}`, 10, y);

  pdf.save(`${fighterName.replace(/ /g, '_')}_Profile.pdf`);
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Event Listeners for selections
document.getElementById('fighterSelect').addEventListener('change', updateSummary);
document.getElementById('factionSelect').addEventListener('change', updateSummary); // Needed for faction runemark
document.getElementById('archetypeSelect').addEventListener('change', updateSummary);
document.getElementById('primarySelect').addEventListener('change', updateSummary);
document.getElementById('secondarySelect').addEventListener('change', updateSummary);
document.getElementById('mountSelect').addEventListener('change', updateSummary);
document.getElementById('blessingSelect').addEventListener('change', updateSummary);
document.getElementById('runemarkSelect').addEventListener('change', updateSummary);
document.getElementById('fighterNameInput').addEventListener('input', updateSummary); // Update name dynamically
