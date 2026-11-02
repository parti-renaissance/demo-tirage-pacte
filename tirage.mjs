// tirage.mjs
// Usage : node tirage.mjs liste.txt "valeur choisie par le commissaire"
// liste.txt : un numéro d'inscription par ligne, sans en-tête.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";

const PLACES = 150;
const [fichier, valeur] = process.argv.slice(2);
if (!fichier || !valeur) throw new Error('usage : node tirage.mjs liste.txt "valeur du commissaire"');

const brut = readFileSync(fichier);
const numeros = brut.toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean);
if (new Set(numeros).size !== numeros.length) throw new Error("un numéro apparaît deux fois");

// Entier tiré uniformément entre 0 et n - 1, dérivé de la valeur du commissaire.
// Les tirages au-delà du plus grand multiple de n sont rejetés, pour qu'aucun
// résultat ne soit plus probable qu'un autre.
let compteur = 0;
const MAX = 2n ** 256n;
function entier(n) {
  const limite = MAX - (MAX % BigInt(n));
  for (;;) {
    const bloc = createHmac("sha256", valeur).update(String(compteur++)).digest("hex");
    const x = BigInt("0x" + bloc);
    if (x < limite) return Number(x % BigInt(n));
  }
}

// Mélange de Fisher-Yates sur la liste entière.
const ordre = [...numeros];
for (let i = ordre.length - 1; i > 0; i--) {
  const j = entier(i + 1);
  [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
}

// Les 150 premiers sont tirés au sort, les suivants forment la liste d'attente, dans l'ordre.
const resultat = ordre
  .map((n, k) => `${k + 1};${n};${k < PLACES ? "tiré au sort" : "liste d'attente"}`)
  .join("\n") + "\n";
writeFileSync("resultat.csv", resultat);

const empreinte = (x) => createHash("sha256").update(x).digest("hex");
console.log("Inscrits dans la liste :", numeros.length);
console.log("Empreinte de la liste  :", empreinte(brut));
console.log("Valeur du commissaire  :", JSON.stringify(valeur));
console.log("Empreinte du résultat  :", empreinte(resultat));
