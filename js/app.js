import * as gh from "./github.js?v=aac8d33";
import {preparar, nombreNuevo, nombrePortada} from "./fotos.js?v=aac8d33";

const WEB = "https://atr-webs.github.io/MORTIZ-WEB/";
const CLAVE = "mortiz-token";

const $ = (s) => document.querySelector(s);
const vistas = {conectar: $("#conectar"), catalogos: $("#catalogos"), catalogo: $("#catalogo")};
const hojas = {catalogo: $("#nuevoCatalogo"), producto: $("#nuevoProducto")};
const listaCatalogos = $("#listaCatalogos");
const listaProductos = $("#listaProductos");
const fotosNuevas = $("#fotosNuevas");
const archivos = $("#archivos");

let datos = {catalogos: []};
let actual = null;
let ordenando = null;
let cambiado = false;
let vistos = new Set();
let nuevas = [];
let ocupado = false;
let vigilancia = 0;
const minisWeb = new Map();
const minisLocales = new Map();

const raiz = (nombre) => nombre.replace(/\.[^.]+$/, "");
const firma = (p) => `${p.nombre}|${p.fotos.join("|")}`;
const portadaDe = (c) => c.portada || c.productos[0]?.fotos[0];
const catalogo = () => datos.catalogos.find((c) => c.slug === actual);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const leerToken = () => { try { return localStorage.getItem(CLAVE) || ""; } catch { return ""; } };
const guardarToken = (t) => { try { t ? localStorage.setItem(CLAVE, t) : localStorage.removeItem(CLAVE); } catch {} };

const mostrar = (nombre) => {
    for (const [k, v] of Object.entries(vistas)) v.hidden = k !== nombre;
    scrollTo(0, 0);
    document.body.classList.remove("desplazado");
};

const abrirHoja = (hoja) => {
    hoja.hidden = false;
    hoja.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => hoja.classList.add("abierta")));
};

const cerrarHoja = (hoja) => {
    hoja.classList.remove("abierta");
    setTimeout(() => !hoja.classList.contains("abierta") && (hoja.hidden = true), 450);
};

addEventListener("scroll", () => document.body.classList.toggle("desplazado", scrollY > 40), {passive: true});

const aviso = (texto, {girando = false, error = false, dura = 0} = {}) => {
    const a = $("#aviso");
    clearTimeout(aviso.t);
    if (!texto) { a.hidden = true; return; }
    a.hidden = false;
    a.classList.toggle("aviso--error", error);
    a.querySelector(".aviso__giro").hidden = !girando;
    a.querySelector(".aviso__texto").textContent = texto;
    if (dura) aviso.t = setTimeout(() => (a.hidden = true), dura);
};

const tallo = (url) => url.split("/").pop().split(".")[0];

const huellaWeb = (cats) => cats.map((c) => `${c.slug}@${c.portada}:${c.productos.map((p) => `${p.nombre}~${p.raiz}`).join(",")}`).join(";");

const huellaDatos = (d) => huellaWeb(d.catalogos.filter((c) => c.productos.length).map((c) => ({
    slug: c.slug,
    portada: raiz(portadaDe(c)),
    productos: c.productos.map((p) => ({nombre: p.nombre, raiz: raiz(p.fotos[0])})),
})));

async function leerWeb() {
    const html = await (await fetch(WEB, {cache: "no-store"})).text();
    const m = html.match(/window\.MORTIZ = (\{.*?\});<\/script>/s);
    const web = m ? JSON.parse(m[1]) : {catalogos: {}};
    const cats = Object.entries(web.catalogos).map(([slug, c]) => ({
        slug,
        portada: c.portada ? (minisWeb.set(tallo(c.portada), new URL(c.portada, WEB).href), tallo(c.portada)) : "",
        productos: c.productos.map((p) => {
            const r = tallo(p.src);
            minisWeb.set(r, new URL(p.src, WEB).href);
            return {nombre: p.nombre, raiz: r};
        }),
    }));
    return huellaWeb(cats);
}

async function miniatura(img, nombre) {
    const r = raiz(nombre);
    if (minisLocales.has(r)) return (img.src = minisLocales.get(r));
    if (minisWeb.has(r)) return (img.src = minisWeb.get(r));
    try {
        const url = URL.createObjectURL(await gh.fotoPrivada(nombre));
        minisLocales.set(r, url);
        img.src = url;
    } catch {}
}

const botonQuitar = (etiqueta, alQuitar) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "foto__quitar";
    b.setAttribute("aria-label", etiqueta);
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>';
    b.addEventListener("click", (e) => {
        e.stopPropagation();
        alQuitar();
    });
    return b;
};

const imagen = (nombre) => {
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    if (nombre) miniatura(img, nombre);
    return img;
};

function pintarCatalogos() {
    listaCatalogos.textContent = "";
    const ordenar = ordenando === "catalogos";
    for (const [i, c] of datos.catalogos.entries()) {
        const li = document.createElement("li");
        li.className = "fila";
        const portada = document.createElement("span");
        portada.className = "fila__portada";
        portada.append(imagen(portadaDe(c)));
        const texto = document.createElement("span");
        texto.className = "fila__texto";
        const nombre = document.createElement("span");
        nombre.className = "fila__nombre";
        nombre.textContent = c.nombre;
        const detalle = document.createElement("span");
        detalle.className = "fila__detalle";
        detalle.textContent = c.productos.length ? plural(c.productos.length, "producto", "productos") : "Vacío · aún no sale en la web";
        texto.append(nombre, detalle);
        li.append(portada, texto);
        if (ordenar) {
            li.append(botonQuitar("Quitar catálogo", () => {
                const n = c.productos.length;
                if (!confirm(`¿Quitar el catálogo «${c.nombre}»${n ? ` y sus ${plural(n, "producto", "productos")}` : ""} de la web?`)) return;
                datos.catalogos.splice(i, 1);
                cambiado = true;
                pintarCatalogos();
            }));
        } else {
            const flecha = document.createElement("span");
            flecha.className = "fila__flecha";
            flecha.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
            li.append(flecha);
            li.addEventListener("click", () => abrirCatalogo(c.slug));
        }
        listaCatalogos.append(li);
    }
    $("#sinCatalogos").hidden = datos.catalogos.length > 0;
    $("#ayudaCatalogos").hidden = !ordenar;
    listaCatalogos.classList.toggle("ordenando", ordenar);
    $("#ordenarCatalogos").textContent = ordenar ? (cambiado ? "Guardar" : "Listo") : "Ordenar";
    $("#agregarCatalogo").disabled = ordenar;
}

function pintarProductos() {
    const c = catalogo();
    if (!c) {
        actual = null;
        pintarCatalogos();
        return mostrar("catalogos");
    }
    const ordenar = ordenando === "productos";
    $("#tituloCatalogo").textContent = c.nombre;
    $("#portadaImg").replaceChildren(imagen(portadaDe(c)));
    $("#portadaDetalle").textContent = c.portada ? "Foto propia" : c.productos.length ? "La del primer producto" : "Sin portada todavía";
    $("#quitarPortada").hidden = !c.portada;
    $("#cambiarPortada").disabled = ordenar;
    $("#quitarPortada").disabled = ordenar;
    $("#tituloChico").textContent = c.nombre;
    listaProductos.textContent = "";
    for (const [i, p] of c.productos.entries()) {
        const li = document.createElement("li");
        li.className = "foto";
        li.append(imagen(p.fotos[0]));
        const nombre = document.createElement("span");
        nombre.className = "foto__nombre";
        nombre.textContent = p.nombre;
        li.append(nombre);
        if (p.fotos.length > 1) {
            const n = document.createElement("span");
            n.className = "foto__cuenta";
            n.textContent = p.fotos.length;
            li.append(n);
        }
        if (ordenar) {
            li.append(botonQuitar("Quitar producto", () => {
                if (!confirm(`¿Quitar «${p.nombre}» de la web?`)) return;
                c.productos.splice(i, 1);
                cambiado = true;
                pintarProductos();
            }));
        }
        listaProductos.append(li);
    }
    $("#catalogoVacio").hidden = c.productos.length > 0;
    $("#ayudaProductos").hidden = !ordenar;
    listaProductos.classList.toggle("ordenando", ordenar);
    $("#ordenarProductos").textContent = ordenar ? (cambiado ? "Guardar" : "Listo") : "Ordenar";
    $("#ordenarProductos").hidden = !c.productos.length && !ordenar;
    $("#agregarProducto").disabled = ordenar;
    $("#volver").disabled = ordenar;
}

const opcionesOrden = (alMover) => ({
    disabled: true,
    animation: 180,
    delay: 120,
    delayOnTouchOnly: true,
    filter: ".foto__quitar",
    preventOnFilter: false,
    onEnd: (e) => {
        if (e.oldIndex !== e.newIndex) alMover(e.oldIndex, e.newIndex);
    },
});

const mover = (lista, de, a) => lista.splice(a, 0, ...lista.splice(de, 1));

const ordenCatalogos = Sortable.create(listaCatalogos, opcionesOrden((de, a) => {
    mover(datos.catalogos, de, a);
    cambiado = true;
    pintarCatalogos();
}));

const ordenProductos = Sortable.create(listaProductos, opcionesOrden((de, a) => {
    mover(catalogo().productos, de, a);
    cambiado = true;
    pintarProductos();
}));

const fotosEnUso = (d) => new Set(d.catalogos.flatMap((c) => [...(c.portada ? [c.portada] : []), ...c.productos.flatMap((p) => p.fotos)]));

const sinUso = (nombres, d) => {
    const uso = fotosEnUso(d);
    return [...new Set(nombres)].filter((f) => !uso.has(f));
};

function abrirCatalogo(slug) {
    actual = slug;
    pintarProductos();
    mostrar("catalogo");
}

$("#volver").addEventListener("click", () => {
    actual = null;
    pintarCatalogos();
    mostrar("catalogos");
});

async function vigilarWeb(esperado) {
    const yo = ++vigilancia;
    aviso("Publicado. Actualizando la web…", {girando: true});
    const meta = huellaDatos(esperado);
    for (let i = 0; i < 40 && yo === vigilancia; i++) {
        await new Promise((r) => setTimeout(r, i ? 8000 : 15000));
        try {
            if ((await leerWeb()) === meta) {
                if (yo === vigilancia) aviso("Listo, ya se ve en la web.", {dura: 4000});
                return;
            }
        } catch {}
    }
    if (yo === vigilancia) aviso("Publicado. La web tarda un poco más de lo normal en actualizarse.", {dura: 6000});
}

async function trabajar(fn) {
    if (ocupado) return;
    ocupado = true;
    document.body.classList.add("ocupado");
    try {
        await fn();
    } catch (e) {
        console.error(e);
        aviso(e.message || "Algo salió mal.", {error: true, dura: 6000});
        if (e.status === 401) desconectar();
    } finally {
        ocupado = false;
        document.body.classList.remove("ocupado");
    }
}

const publicar = async (cambio, conAviso = true) => {
    datos = await gh.guardar(cambio, (t) => aviso(t, {girando: true}));
    if (conAviso) vigilarWeb(datos);
    else aviso("Guardado.", {dura: 2500});
};

async function cargar() {
    aviso("Cargando…", {girando: true});
    await Promise.all([gh.leer().then((d) => (datos = d)), leerWeb().catch(() => {})]);
    aviso("");
    if (actual && catalogo()) pintarProductos();
    else pintarCatalogos();
}

$("#ordenarCatalogos").addEventListener("click", () => trabajar(async () => {
    if (ordenando !== "catalogos") {
        ordenando = "catalogos";
        cambiado = false;
        vistos = new Set(datos.catalogos.map((c) => c.slug));
        ordenCatalogos.option("disabled", false);
        pintarCatalogos();
        return;
    }
    if (cambiado) {
        const deseado = datos.catalogos.map((c) => c.slug);
        await publicar((d) => {
            const deOtro = d.catalogos.filter((c) => !vistos.has(c.slug));
            const ordenados = deseado.map((s) => d.catalogos.find((c) => c.slug === s)).filter(Boolean);
            const borrados = d.catalogos.filter((c) => vistos.has(c.slug) && !deseado.includes(c.slug));
            const nuevo = {...d, catalogos: [...deOtro, ...ordenados]};
            return {
                datos: nuevo,
                borrar: sinUso(borrados.flatMap((c) => [...(c.portada ? [c.portada] : []), ...c.productos.flatMap((p) => p.fotos)]), nuevo),
                mensaje: borrados.length ? "Catálogos: ordenar y quitar" : "Catálogos: cambiar el orden",
            };
        });
    }
    ordenando = null;
    cambiado = false;
    ordenCatalogos.option("disabled", true);
    pintarCatalogos();
}));

$("#ordenarProductos").addEventListener("click", () => trabajar(async () => {
    const c = catalogo();
    if (ordenando !== "productos") {
        ordenando = "productos";
        cambiado = false;
        vistos = new Set(c.productos.map(firma));
        ordenProductos.option("disabled", false);
        pintarProductos();
        return;
    }
    if (cambiado) {
        const deseado = c.productos.map(firma);
        const slug = c.slug;
        await publicar((d) => {
            const cat = d.catalogos.find((x) => x.slug === slug);
            if (!cat) throw new Error("Ese catálogo ya no existe.");
            const deOtro = cat.productos.filter((p) => !vistos.has(firma(p)));
            const ordenados = deseado.map((f) => cat.productos.find((p) => firma(p) === f)).filter(Boolean);
            const borrados = cat.productos.filter((p) => vistos.has(firma(p)) && !deseado.includes(firma(p)));
            cat.productos = [...deOtro, ...ordenados];
            return {
                datos: d,
                borrar: sinUso(borrados.flatMap((p) => p.fotos), d),
                mensaje: `${cat.nombre}: ${borrados.length ? "ordenar y quitar productos" : "cambiar el orden"}`,
            };
        });
    }
    ordenando = null;
    cambiado = false;
    ordenProductos.option("disabled", true);
    pintarProductos();
}));

const slugDe = (nombre, existentes) => {
    const base = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "catalogo";
    let slug = base;
    for (let n = 2; existentes.has(slug); n++) slug = `${base}-${n}`;
    return slug;
};

$("#agregarCatalogo").addEventListener("click", () => {
    if (ocupado) return;
    $("#nombreCatalogo").value = "";
    $("#crearCatalogo").disabled = true;
    abrirHoja(hojas.catalogo);
    setTimeout(() => $("#nombreCatalogo").focus(), 350);
});

$("#nombreCatalogo").addEventListener("input", () => {
    $("#crearCatalogo").disabled = !$("#nombreCatalogo").value.trim();
});

const crearCatalogo = () => trabajar(async () => {
    const nombre = $("#nombreCatalogo").value.trim();
    if (!nombre) return;
    let slug;
    await publicar((d) => {
        slug = slugDe(nombre, new Set(d.catalogos.map((c) => c.slug)));
        d.catalogos.unshift({slug, nombre, leyenda: "", productos: []});
        return {datos: d, mensaje: `Catálogos: nuevo «${nombre}»`};
    }, false);
    cerrarHoja(hojas.catalogo);
    abrirCatalogo(slug);
});

$("#crearCatalogo").addEventListener("click", crearCatalogo);
$("#formCatalogo").addEventListener("submit", (e) => {
    e.preventDefault();
    crearCatalogo();
});

function pintarNuevas() {
    fotosNuevas.textContent = "";
    for (const [i, f] of nuevas.entries()) {
        const li = document.createElement("li");
        li.className = "foto";
        const img = document.createElement("img");
        img.src = f.url;
        img.alt = "";
        li.append(img);
        if (i === 0) {
            const tag = document.createElement("span");
            tag.className = "foto__etiqueta";
            tag.textContent = "Principal";
            li.append(tag);
        }
        li.append(botonQuitar("Quitar foto", () => {
            URL.revokeObjectURL(f.url);
            nuevas.splice(i, 1);
            pintarNuevas();
        }));
        li.addEventListener("click", () => {
            if (i === 0) return;
            nuevas.unshift(...nuevas.splice(i, 1));
            pintarNuevas();
        });
        fotosNuevas.append(li);
    }
    $("#elegir").hidden = nuevas.length > 0;
    $("#seleccion").hidden = nuevas.length === 0;
    $("#publicar").disabled = nuevas.length === 0 || !$("#nombreProducto").value.trim();
}

Sortable.create(fotosNuevas, {
    animation: 180,
    delay: 120,
    delayOnTouchOnly: true,
    filter: ".foto__quitar",
    preventOnFilter: false,
    onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        mover(nuevas, e.oldIndex, e.newIndex);
        pintarNuevas();
    },
});

const limpiarNuevas = () => {
    for (const f of nuevas) URL.revokeObjectURL(f.url);
    nuevas = [];
    $("#nombreProducto").value = "";
    pintarNuevas();
};

$("#agregarProducto").addEventListener("click", () => {
    if (ocupado) return;
    limpiarNuevas();
    abrirHoja(hojas.producto);
});

$("#nombreProducto").addEventListener("input", pintarNuevas);

for (const b of document.querySelectorAll("[data-cerrar]")) {
    b.addEventListener("click", () => {
        if (ocupado) return;
        const hoja = b.closest(".hoja");
        if (hoja === hojas.producto) limpiarNuevas();
        cerrarHoja(hoja);
    });
}

$("#elegir").addEventListener("click", () => archivos.click());
$("#masFotos").addEventListener("click", () => archivos.click());

archivos.addEventListener("change", () => trabajar(async () => {
    const elegidos = [...archivos.files];
    archivos.value = "";
    for (const [i, archivo] of elegidos.entries()) {
        aviso(`Preparando foto ${i + 1} de ${elegidos.length}…`, {girando: true});
        const blob = await preparar(archivo);
        nuevas.push({blob, url: URL.createObjectURL(blob)});
    }
    aviso("");
    pintarNuevas();
}));

$("#publicar").addEventListener("click", () => trabajar(async () => {
    const nombre = $("#nombreProducto").value.trim();
    if (!nuevas.length || !nombre) return;
    const slug = actual;
    const fotos = nuevas.map((f, i) => ({...f, nombre: nombreNuevo(i)}));
    const producto = {nombre, fotos: fotos.map((f) => f.nombre)};
    await publicar((d) => {
        const cat = d.catalogos.find((c) => c.slug === slug);
        if (!cat) throw new Error("Ese catálogo ya no existe.");
        cat.productos.unshift(producto);
        return {datos: d, nuevas: fotos, mensaje: `${cat.nombre}: nuevo producto «${nombre}»`};
    });
    minisLocales.set(raiz(fotos[0].nombre), fotos[0].url);
    for (const f of fotos.slice(1)) URL.revokeObjectURL(f.url);
    nuevas = [];
    $("#nombreProducto").value = "";
    cerrarHoja(hojas.producto);
    pintarProductos();
}));

$("#cambiarPortada").addEventListener("click", () => !ocupado && $("#archivoPortada").click());

$("#archivoPortada").addEventListener("change", () => trabajar(async () => {
    const archivo = $("#archivoPortada").files[0];
    $("#archivoPortada").value = "";
    if (!archivo) return;
    aviso("Preparando foto…", {girando: true});
    const blob = await preparar(archivo);
    const foto = {blob, url: URL.createObjectURL(blob), nombre: nombrePortada()};
    const slug = actual;
    await publicar((d) => {
        const cat = d.catalogos.find((c) => c.slug === slug);
        if (!cat) throw new Error("Ese catálogo ya no existe.");
        const anterior = cat.portada;
        cat.portada = foto.nombre;
        return {datos: d, nuevas: [foto], borrar: anterior ? sinUso([anterior], d) : [], mensaje: `${cat.nombre}: nueva portada`};
    });
    minisLocales.set(raiz(foto.nombre), foto.url);
    pintarProductos();
}));

$("#quitarPortada").addEventListener("click", () => trabajar(async () => {
    if (!confirm("¿Quitar la portada propia? Se usará la foto del primer producto.")) return;
    const slug = actual;
    await publicar((d) => {
        const cat = d.catalogos.find((c) => c.slug === slug);
        if (!cat) throw new Error("Ese catálogo ya no existe.");
        const anterior = cat.portada;
        delete cat.portada;
        return {datos: d, borrar: anterior ? sinUso([anterior], d) : [], mensaje: `${cat.nombre}: portada del primer producto`};
    });
    pintarProductos();
}));

function desconectar() {
    guardarToken("");
    gh.usarToken("");
    datos = {catalogos: []};
    actual = null;
    mostrar("conectar");
}

$("#desconectar").addEventListener("click", () => {
    if (confirm("¿Quitar el token de este teléfono?")) desconectar();
});

$("#crearToken").href = "https://github.com/settings/personal-access-tokens/new?" + new URLSearchParams({
    name: "Mortiz app",
    description: "Publicar catálogos en la web desde la app",
    target_name: "ATR-WEBS",
    expires_in: "none",
    contents: "write",
});

$("#formToken").addEventListener("submit", (e) => {
    e.preventDefault();
    trabajar(async () => {
        const t = $("#token").value.trim();
        gh.usarToken(t);
        aviso("Comprobando…", {girando: true});
        await gh.comprobar();
        guardarToken(t);
        $("#token").value = "";
        mostrar("catalogos");
        await cargar();
    });
});

const guardado = leerToken();
if (guardado) {
    gh.usarToken(guardado);
    mostrar("catalogos");
    trabajar(cargar);
} else {
    mostrar("conectar");
}
