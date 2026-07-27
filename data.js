/* ------------------------------------------------------------------
   Données tarifaires — vélos en free-floating à Paris
   ------------------------------------------------------------------
   Tous les tarifs sont relevés dans les applications, pour Paris.

   Types de forfaits :
   - payg     : déblocage + prix/minute
   - pass     : bundle de minutes, valable N jours, déblocage inclus
   - per_ride : abonnement + prix fixe par trajet, plafonné à `capMin`
                (ou paliers dégressifs via `tiers`)
   ------------------------------------------------------------------ */

const OPERATORS = [
  {
    id: "voi",
    name: "Voi",
    file: "Voi",
    color: "#F26961",
    updated: "21/07/2026",
    plans: [
      { id: "voi-payg", name: "À la minute", type: "payg", unlock: 0, rate: 0.29 },
      { id: "voi-30",  name: "Pass 30 min",  type: "pass", price: 2.99,  minutes: 30,  days: 1 },
      { id: "voi-60",  name: "Pass 60 min",  type: "pass", price: 6.49,  minutes: 60,  days: 3 },
      { id: "voi-120", name: "Pass 120 min", type: "pass", price: 12.49, minutes: 120, days: 7 },
      { id: "voi-200", name: "Pass 200 min", type: "pass", price: 18.99, minutes: 200, days: 30 },
      { id: "voi-400", name: "Pass 400 min", type: "pass", price: 31.99, minutes: 400, days: 30 },
    ],
  },
  {
    id: "lime",
    name: "Lime",
    file: "Lime",
    color: "#00DD00",
    updated: "21/07/2026",
    plans: [
      { id: "lime-payg", name: "À la minute", type: "payg", unlock: 0, rate: 0.28 },
      { id: "lime-30",  name: "LimePass 30 min",  type: "pass", price: 3.99,  minutes: 30,  days: 1 },
      { id: "lime-60",  name: "LimePass 60 min",  type: "pass", price: 6.99,  minutes: 60,  days: 3 },
      { id: "lime-200", name: "LimePass 200 min", type: "pass", price: 21.99, minutes: 200, days: 30 },
      { id: "lime-400", name: "LimePass 400 min", type: "pass", price: 39.99, minutes: 400, days: 90 },
      {
        id: "lime-prime",
        name: "LimePrime",
        type: "per_ride",
        price: 4.99,
        days: 30,
        // Prix du trajet dégressif selon sa durée, déverrouillage inclus.
        tiers: [
          { maxMin: 5, price: 1.0 },
          { maxMin: 20, price: 1.5 },
        ],
        note: "trajets illimités : 1 € jusqu'à 5 min, 1,50 € jusqu'à 20 min, déverrouillages inclus",
      },
    ],
  },
  {
    id: "dott",
    name: "Dott",
    file: "Dott",
    color: "#00A8E9",
    updated: "21/07/2026",
    plans: [
      { id: "dott-payg", name: "À la minute", type: "payg", unlock: 1.0, rate: 0.35 },
      { id: "dott-30",  name: "Pass 30 min",  type: "pass", price: 3.99,  minutes: 30,  days: 1 },
      { id: "dott-100", name: "Pass 100 min", type: "pass", price: 11.99, minutes: 100, days: 7 },
      { id: "dott-400", name: "Pass 400 min", type: "pass", price: 37.99, minutes: 400, days: 90 },
      {
        id: "dott-pro",
        name: "Dott Pro",
        type: "per_ride",
        price: 9.99,
        days: 30,
        ridePrice: 1.35,
        capMin: 30,
        note: "trajets illimités de 30 min à 1,35 € pièce, déblocages inclus",
      },
      {
        id: "dott-flex",
        name: "Dott Flex",
        type: "per_ride",
        price: 5.99,
        days: 30,
        ridePrice: 1.75,
        capMin: 30,
        note: "trajets illimités de 30 min à 1,75 € pièce, déblocages inclus",
      },
    ],
  },
];
