/**
 * E2E Test : cycle complet statut habilitation
 *
 * Prérequis : `npm run dev` doit tourner sur http://localhost:1420
 * Lancer avec : npm run test:e2e
 *
 * Scénario :
 *  1. Crée un appareil "Scanographe E2E" et lui ajoute une compétence requise
 *  2. Crée le travailleur "E2ETEST / Hab"
 *  3. Badge initial → "Non renseigné" (aucune date, aucun appareil)
 *  4. Onglet Habilitation : assigne Scanographe E2E au travailleur
 *  5. Remplit les 5 items d'habilitation (dates valides)
 *  6. Badge → "Partielle" (dates OK mais compétence non validée)
 *  7. Valide la compétence
 *  8. Badge → "À jour"  ← régression corrigée (vacuous truth)
 *  9. Dévalide la compétence → Badge → "Partielle"
 */

import puppeteer, { type Browser, type Page } from 'puppeteer';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:1420';
const NAV_TIMEOUT = 20_000;
const WAIT_TIMEOUT = 10_000;

// Date de validation : ~6 mois avant aujourd'hui, dans toutes les plages de validité
const VALID_DATE = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
})();

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Attend que `text` apparaisse quelque part dans le texte visible de la page. */
async function waitForText(page: Page, text: string, timeout = WAIT_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (t: string) => document.body.innerText.includes(t),
    { timeout },
    text,
  );
}

/** Clique le premier bouton dont le textContent contient `text`. */
async function clickButtonContains(page: Page, text: string): Promise<void> {
  await page.evaluate((t: string) => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim().includes(t));
    (btn as HTMLElement | null)?.click();
  }, text);
}

/** Clique le premier bouton dont le textContent est exactement `text`. */
async function clickButtonExact(page: Page, text: string): Promise<void> {
  await page.evaluate((t: string) => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === t);
    (btn as HTMLElement | null)?.click();
  }, text);
}

/**
 * Remplit un <input> React via le native setter, puis dispatch input+change.
 * Nécessaire pour les inputs date (page.type n'interagit pas bien avec eux).
 */
async function fillReactInput(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(
    (sel: string, val: string) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) throw new Error(`Input introuvable : ${sel}`);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    selector,
    value,
  );
}

/**
 * Récupère le texte du badge Habilitation dans l'en-tête de TravailleurFiche.
 * Renvoie "" si le badge n'est pas encore rendu.
 */
async function getHabBadgeText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const container = Array.from(document.querySelectorAll('div')).find(
      d => d.className.includes('text-right') && d.textContent?.includes('Habilitation'),
    );
    if (!container) return '';
    // Le Badge est le premier <span> enfant
    const span = container.querySelector('span');
    return span?.textContent?.trim() ?? '';
  });
}

/**
 * Attend que le badge Habilitation affiche `expectedText`,
 * en sondant le DOM toutes les ~100 ms.
 */
async function waitForHabBadge(page: Page, expectedText: string, timeout = WAIT_TIMEOUT * 2): Promise<void> {
  await page.waitForFunction(
    (expected: string) => {
      const container = Array.from(document.querySelectorAll('div')).find(
        d => d.className.includes('text-right') && d.textContent?.includes('Habilitation'),
      );
      if (!container) return false;
      const span = container.querySelector('span');
      return span?.textContent?.trim().includes(expected) ?? false;
    },
    { timeout },
    expectedText,
  );
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('Habilitation — cycle complet (E2E)', { timeout: 180_000 }, () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    page.setDefaultTimeout(WAIT_TIMEOUT);
    // Chargement initial
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT });
  }, 45_000);

  afterAll(async () => {
    await browser.close();
  });

  // ── 1. Créer l'appareil ──────────────────────────────────────────────────────

  it('crée "Scanographe E2E" et lui ajoute la première compétence requise', async () => {
    await page.goto(`${BASE_URL}/appareils`, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT });
    await waitForText(page, 'Ajouter un appareil');

    // Ouvre le modal
    await clickButtonContains(page, 'Ajouter un appareil');
    await page.waitForSelector('#designation', { timeout: WAIT_TIMEOUT });

    // Remplit la désignation
    await page.click('#designation');
    await page.type('#designation', 'Scanographe E2E');

    // Soumet (bouton type=submit dans le modal)
    await page.evaluate(() => {
      const modal = Array.from(document.querySelectorAll('div')).find(
        d => d.classList.contains('fixed') && d.classList.contains('inset-0'),
      );
      const submitBtn = modal?.querySelector('button[type="submit"]');
      (submitBtn as HTMLElement | null)?.click();
    });

    // Attend que l'appareil apparaisse dans la liste
    await waitForText(page, 'Scanographe E2E');

    // Clique sur la ligne pour aller à AppareilFiche
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(
        r => r.textContent?.includes('Scanographe E2E'),
      );
      (row as HTMLElement | null)?.click();
    });

    // Attend la section Compétences requises
    await waitForText(page, 'Compétences requises');

    // Clique sur la première compétence pour l'ajouter comme requise
    await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('div')).find(
        d => d.textContent?.includes('Compétences requises') &&
          d.textContent?.includes('Mise sous tension'),
      );
      const btn = card?.querySelector('button');
      (btn as HTMLElement | null)?.click();
    });

    // Attend le badge "1 sélectionnée"
    await waitForText(page, '1 sélectionnée');
  });

  // ── 2. Créer le travailleur ──────────────────────────────────────────────────

  it('crée "E2ETEST / Hab" et vérifie le badge initial "Non renseigné"', async () => {
    await page.goto(`${BASE_URL}/travailleurs`, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT });
    await waitForText(page, 'Ajouter un travailleur');

    // Ouvre le modal
    await clickButtonContains(page, 'Ajouter un travailleur');
    await page.waitForSelector('input[placeholder="Dupont"]', { timeout: WAIT_TIMEOUT });

    // Remplit nom + prénom
    await page.type('input[placeholder="Dupont"]', 'E2ETEST');
    await page.type('input[placeholder="Jean"]', 'Hab');

    // Soumet
    await page.evaluate(() => {
      const modal = Array.from(document.querySelectorAll('div')).find(
        d => d.classList.contains('fixed') && d.classList.contains('inset-0'),
      );
      const submitBtn = modal?.querySelector('button[type="submit"]');
      (submitBtn as HTMLElement | null)?.click();
    });

    // Attend que le travailleur apparaisse dans la liste
    await waitForText(page, 'E2ETEST');

    // Clique sur la ligne pour aller à TravailleurFiche
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(
        r => r.textContent?.includes('E2ETEST') && r.textContent?.includes('Hab'),
      );
      (row as HTMLElement | null)?.click();
    });

    // Attend le chargement de la fiche (titre + badge)
    await waitForText(page, 'E2ETEST');

    // Badge initial : "Non renseigné" (aucune date)
    await waitForHabBadge(page, 'Non renseigné');
    const badge = await getHabBadgeText(page);
    expect(badge).toContain('Non renseigné');
  });

  // ── 3. Assigner l'appareil et remplir les 5 items ───────────────────────────

  it('assigne Scanographe E2E et remplit les dates → badge "Partielle"', async () => {
    // Onglet Habilitation
    await clickButtonContains(page, 'Habilitation');
    await waitForText(page, "Items d'habilitation");

    // ── Assigner l'appareil ─────────────────────────────────────────────────
    await waitForText(page, 'Ajouter des appareils');

    // Coche la checkbox "Scanographe E2E"
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label')).find(
        l => l.textContent?.includes('Scanographe E2E'),
      );
      const checkbox = label?.querySelector('input[type="checkbox"]');
      (checkbox as HTMLElement | null)?.click();
    });

    // Attend le bouton "Ajouter (1 sélectionné)"
    await waitForText(page, 'Ajouter (1 sélectionné');
    await clickButtonContains(page, 'Ajouter (1 sélectionné');

    // Attend que l'appareil apparaisse dans "Appareils assignés"
    await waitForText(page, 'Scanographe E2E');

    // ── Remplir les 5 items d'habilitation ────────────────────────────────
    const habItems = [
      'Dosimétrie passive',
      'Dosimétrie opérationnelle',
      'Formation RP travailleurs',
      'Formation RP patients',
      'Visite médicale',
    ];

    for (const title of habItems) {
      // Clique sur la ligne de l'item (le div.font-medium contient le titre)
      await page.evaluate((t: string) => {
        const titleEl = Array.from(document.querySelectorAll('.font-medium')).find(
          el => el.textContent?.trim() === t,
        );
        // Structure : div.cursor-pointer > div.flex-1 > div.font-medium
        const clickableParent = titleEl?.parentElement?.parentElement;
        (clickableParent as HTMLElement | null)?.click();
      }, title);

      // Attend qu'un input[type="date"] apparaisse (le modal s'ouvre)
      await page.waitForSelector('input[type="date"]', { timeout: WAIT_TIMEOUT });

      // Remplit la date
      await fillReactInput(page, 'input[type="date"]', VALID_DATE);

      // Clique "Enregistrer" dans le modal
      await clickButtonExact(page, 'Enregistrer');

      // Attend la fermeture du modal (l'input date disparaît)
      await page.waitForFunction(
        () => document.querySelector('input[type="date"]') === null,
        { timeout: WAIT_TIMEOUT },
      );
    }

    // ── Vérification : badge "Partielle" ─────────────────────────────────
    // Toutes les dates sont valides, mais la compétence n'est pas encore validée
    await waitForHabBadge(page, 'Partielle');
    const badge = await getHabBadgeText(page);
    expect(badge).toContain('Partielle');
  });

  // ── 4. Valider la compétence → badge "À jour" ────────────────────────────────

  it('valide "Mise sous tension de l\'appareil" → badge passe à "À jour"', async () => {
    await waitForText(page, 'Compétences par appareil');

    // Clique la première compétence pour la valider
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('Mise sous tension'),
      );
      (btn as HTMLElement | null)?.click();
    });

    // Badge → "À jour"
    await waitForHabBadge(page, 'À jour');
    const badge = await getHabBadgeText(page);
    expect(badge).toContain('À jour');
  });

  // ── 5. Dévalider → badge "Partielle" ────────────────────────────────────────

  it('retire la validation → badge repasse à "Partielle"', async () => {
    // Reclique pour dévalider
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('Mise sous tension'),
      );
      (btn as HTMLElement | null)?.click();
    });

    // Badge → "Partielle"
    await waitForHabBadge(page, 'Partielle');
    const badge = await getHabBadgeText(page);
    expect(badge).toContain('Partielle');
  });
});
