// Calcul du tirage, identique ligne à ligne à tirage.mjs (Node.js).
// Même entrée (fichier de numéros, valeur du commissaire) => même résultat, même empreinte.

const PLACES = 150;
const enc = new TextEncoder();

async function sha256Hex(octets) {
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tirer(brut, valeur) {
  // brut : Uint8Array du fichier liste.txt ; valeur : texte saisi par le commissaire.
  const numeros = new TextDecoder().decode(brut).split("\n").map((l) => l.trim()).filter(Boolean);
  if (new Set(numeros).size !== numeros.length) throw new Error("un numéro apparaît deux fois");

  const cle = await crypto.subtle.importKey("raw", enc.encode(valeur), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  let compteur = 0;
  const MAX = 2n ** 256n;
  async function entier(n) {
    const limite = MAX - (MAX % BigInt(n));
    for (;;) {
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cle, enc.encode(String(compteur++))));
      const x = BigInt("0x" + [...sig].map((b) => b.toString(16).padStart(2, "0")).join(""));
      if (x < limite) return Number(x % BigInt(n));
    }
  }

  const ordre = [...numeros];
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = await entier(i + 1);
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }

  const resultat = ordre
    .map((n, k) => `${k + 1};${n};${k < PLACES ? "tiré au sort" : "liste d'attente"}`)
    .join("\n") + "\n";

  return {
    ordre,
    resultat,
    nombre: numeros.length,
    empreinteListe: await sha256Hex(brut),
    empreinteResultat: await sha256Hex(enc.encode(resultat)),
  };
}

if (typeof module !== "undefined") module.exports = { tirer, sha256Hex, PLACES };
