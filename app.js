/* YDRX - app.js (modo pruebas sin servidor con localStorage) */

const DB_KEY = "ydrx_db_v1";

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw);

  const db = {
    users: [
      // admin demo
      { id: "u_admin", email: "admin@ydrx.local", pass: "admin123", user: "@admin", role: "admin", balance: 0 }
    ],
    products: [
      // productos demo (los puedes borrar luego)
      { id: "p1", name: "Producto 1", active: true, variants: {
        perfil:  { price: 50, stock: [] },
        completa:{ price: 90, stock: [] }
      }},
    ],
    orders: [],
    topups: [], // recargas manuales (pendientes/aprobadas)
    session: { userId: null }
  };

  saveDB(db);
  return db;
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(prefix="id") {
  return prefix + "_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalizeUser(v) {
  v = (v || "").trim();
  if (v.startsWith("@")) v = v.slice(1);
  v = v.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return "@" + v;
}

/* --------- Sesión --------- */
function currentUser() {
  const db = loadDB();
  return db.users.find(u => u.id === db.session.userId) || null;
}

function requireLogin() {
  const u = currentUser();
  if (!u) window.location.href = "login.html";
  return u;
}

function logout() {
  const db = loadDB();
  db.session.userId = null;
  saveDB(db);
  window.location.href = "index.html";
}

/* --------- Auth --------- */
function registerUser({ email, pass, user }) {
  const db = loadDB();
  email = (email || "").trim().toLowerCase();
  user = normalizeUser(user);

  if (!email) throw new Error("Falta correo");
  if (!pass || pass.length < 6) throw new Error("Contraseña mínimo 6");
  if (user.length < 4) throw new Error("@user muy corto");

  if (db.users.some(u => u.email === email)) throw new Error("Ese correo ya existe");
  if (db.users.some(u => u.user === user)) throw new Error("Ese @user ya existe");

  const newUser = { id: uid("u"), email, pass, user, role: "user", balance: 0 };
  db.users.push(newUser);
  db.session.userId = newUser.id;
  saveDB(db);
  return newUser;
}

function loginUser({ email, pass }) {
  const db = loadDB();
  email = (email || "").trim().toLowerCase();
  const u = db.users.find(x => x.email === email && x.pass === pass);
  if (!u) throw new Error("Correo o contraseña incorrectos");
  db.session.userId = u.id;
  saveDB(db);
  return u;
}

/* --------- Productos / Stock --------- */
function listProducts() {
  const db = loadDB();
  return db.products.filter(p => p.active);
}

function addProduct({ name, perfilPrice, completaPrice }) {
  const db = loadDB();
  const p = {
    id: uid("p"),
    name: name || "Nuevo producto",
    active: true,
    variants: {
      perfil:   { price: Number(perfilPrice || 0), stock: [] },
      completa: { price: Number(completaPrice || 0), stock: [] }
    }
  };
  db.products.push(p);
  saveDB(db);
  return p;
}

function updateProduct(pId, patch) {
  const db = loadDB();
  const p = db.products.find(x => x.id === pId);
  if (!p) throw new Error("Producto no existe");

  if (typeof patch.name === "string") p.name = patch.name;
  if (typeof patch.active === "boolean") p.active = patch.active;

  if (patch.perfilPrice != null) p.variants.perfil.price = Number(patch.perfilPrice);
  if (patch.completaPrice != null) p.variants.completa.price = Number(patch.completaPrice);

  saveDB(db);
  return p;
}

// stockItems: array de strings (códigos/cuentas). Se guardan como texto.
function addStock(pId, variant, stockItems) {
  const db = loadDB();
  const p = db.products.find(x => x.id === pId);
  if (!p) throw new Error("Producto no existe");
  if (!p.variants[variant]) throw new Error("Variante inválida");

  const items = (stockItems || [])
    .map(s => (s || "").trim())
    .filter(Boolean);

  p.variants[variant].stock.push(...items);
  saveDB(db);
  return items.length;
}

/* --------- Compra (descuenta saldo y stock + entrega) --------- */
function buyProduct({ pId, variant }) {
  const db = loadDB();
  const u = db.users.find(x => x.id === db.session.userId);
  if (!u) throw new Error("No has iniciado sesión");

  const p = db.products.find(x => x.id === pId && x.active);
  if (!p) throw new Error("Producto no disponible");
  if (!p.variants[variant]) throw new Error("Variante inválida");

  const price = Number(p.variants[variant].price);
  const stockArr = p.variants[variant].stock;

  if (stockArr.length <= 0) throw new Error("Sin stock");
  if (u.balance < price) throw new Error("Saldo insuficiente");

  // entrega: toma 1 item
  const delivered = stockArr.shift();

  u.balance -= price;

  const order = {
    id: uid("o"),
    userId: u.id,
    when: new Date().toISOString(),
    items: [{ productId: p.id, name: p.name, variant, price, delivered }],
    total: price,
    status: "paid"
  };

  db.orders.push(order);
  saveDB(db);
  return order;
}

function myOrders() {
  const db = loadDB();
  const u = db.users.find(x => x.id === db.session.userId);
  if (!u) return [];
  return db.orders.filter(o => o.userId === u.id).sort((a,b)=> b.when.localeCompare(a.when));
}

/* --------- Recargas (manual) --------- */
function requestTopup({ amount, ref }) {
  const db = loadDB();
  const u = db.users.find(x => x.id === db.session.userId);
  if (!u) throw new Error("No has iniciado sesión");
  const a = Number(amount);
  if (!a || a <= 0) throw new Error("Monto inválido");

  const t = {
    id: uid("t"),
    userId: u.id,
    amount: a,
    ref: (ref || "").trim(),
    status: "pending",
    when: new Date().toISOString()
  };
  db.topups.push(t);
  saveDB(db);
  return t;
}

function listTopups() {
  const db = loadDB();
  return db.topups.sort((a,b)=> b.when.localeCompare(a.when));
}

function approveTopup(tId) {
  const db = loadDB();
  const t = db.topups.find(x => x.id === tId);
  if (!t) throw new Error("Recarga no existe");
  if (t.status !== "pending") throw new Error("Ya fue procesada");

  const u = db.users.find(x => x.id === t.userId);
  if (!u) throw new Error("Usuario no existe");

  u.balance += Number(t.amount);
  t.status = "approved";
  t.approvedWhen = new Date().toISOString();

  saveDB(db);
  return t;
}

function rejectTopup(tId) {
  const db = loadDB();
  const t = db.topups.find(x => x.id === tId);
  if (!t) throw new Error("Recarga no existe");
  if (t.status !== "pending") throw new Error("Ya fue procesada");

  t.status = "rejected";
  t.rejectedWhen = new Date().toISOString();
  saveDB(db);
  return t;
}

/* --------- Utilidad: reset total (solo pruebas) --------- */
function resetAll() {
  localStorage.removeItem(DB_KEY);
  loadDB();
}

/* Exponer en window para usar en las páginas */
window.YDRX = {
  loadDB, saveDB, resetAll,
  currentUser, requireLogin, logout,
  registerUser, loginUser,
  listProducts, addProduct, updateProduct, addStock,
  buyProduct, myOrders,
  requestTopup, listTopups, approveTopup, rejectTopup
};
