// Synthetic, hand-checked fixture: scripts/fixtures/bid/complete-straight-hand-oracle.json
// in the MasonIQ bid-acceptance worktree. These are sample rates, not a quote.
const fullCount = 174;
const halfCount = 12;
const fullUnitCents = 333;
const halfUnitCents = 222;
const selectedGroutCells = 360;
const groutCellsPerCy = 240; // Sample 8-inch CMU grout yield.
const groutTenthsCy = (selectedGroutCells * 10) / groutCellsPerCy;
const groutCentsPerCy = 30_000;
const mortarPiecesPerBag = 31;
const mortarBags = Math.ceil((fullCount + halfCount) / mortarPiecesPerBag);
const mortarCentsPerBag = 499;
const blockPiecesPerMasonDay = 186;
const groutCyPerMasonDay = 1.5;
const masonDaysForBlock = Math.ceil((fullCount + halfCount) / blockPiecesPerMasonDay);
const masonDaysForGrout = Math.ceil((groutTenthsCy / 10) / groutCyPerMasonDay);
const hoursPerMasonDay = 8;
const masonHourlyCents = 2_000;
const mixerDays = 2;
const mixerCentsPerDay = 1_000;
const overheadPercent = 10;
const profitPercent = 10;

const fullCents = fullCount * fullUnitCents;
const halfCents = halfCount * halfUnitCents;
const groutCents = (groutTenthsCy * groutCentsPerCy) / 10;
const mortarCents = mortarBags * mortarCentsPerBag;
const materialsCents = fullCents + halfCents + groutCents + mortarCents;
const blockLaborCents = masonDaysForBlock * hoursPerMasonDay * masonHourlyCents;
const groutLaborCents = masonDaysForGrout * hoursPerMasonDay * masonHourlyCents;
const laborCents = blockLaborCents + groutLaborCents;
const equipmentCents = mixerDays * mixerCentsPerDay;
const costCents = materialsCents + laborCents + equipmentCents;
const overheadCents = (costCents * overheadPercent) / 100;
const profitCents = ((costCents + overheadCents) * profitPercent) / 100;
const bidCents = costCents + overheadCents + profitCents;

export const estimateExample = {
  label: 'Worked example · sample rates',
  wall: {
    lengthFeet: 20,
    heightFeet: 8,
    nominalCmuInches: 8,
    areaSquareFeet: 20 * 8,
    fullCount,
    halfCount,
    laidPieces: fullCount + halfCount,
    groutCy: groutTenthsCy / 10,
    selectedGroutCells,
    groutCellsPerCy,
    mortarBags,
    mortarPiecesPerBag,
  },
  materials: [
    { name: 'Full 8-inch CMU', quantity: fullCount, unit: 'blocks', unitCents: fullUnitCents, cents: fullCents },
    { name: 'Factory half CMU', quantity: halfCount, unit: 'blocks', unitCents: halfUnitCents, cents: halfCents },
    { name: 'Grout', quantity: groutTenthsCy / 10, unit: 'CY', unitCents: groutCentsPerCy, cents: groutCents },
    { name: 'Mortar', quantity: mortarBags, unit: 'bags', unitCents: mortarCentsPerBag, cents: mortarCents },
  ],
  labor: {
    masonCount: 1,
    hoursPerMasonDay,
    hourlyCents: masonHourlyCents,
    blockPiecesPerMasonDay,
    groutCyPerMasonDay,
    blockDays: masonDaysForBlock,
    groutDays: masonDaysForGrout,
    blockCents: blockLaborCents,
    groutCents: groutLaborCents,
    cents: laborCents,
  },
  equipment: {
    name: 'Day-only mixer',
    days: mixerDays,
    centsPerDay: mixerCentsPerDay,
    cents: equipmentCents,
  },
  totals: {
    materialsCents,
    laborCents,
    equipmentCents,
    costCents,
    overheadPercent,
    overheadCents,
    profitPercent,
    profitCents,
    bidCents,
  },
} as const;