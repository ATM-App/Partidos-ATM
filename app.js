const myDeviceId = Math.random().toString(36).substr(2, 9);
let liveMatchUnsubscribe = null;

let partidoData = {
    estado: 'previo', 
    inicioPeriodoTimestamp: null,
    segundosAcumuladosPrimera: 0,
    modalidad: sessionStorage.getItem('equipoModalidad') || 'f11',
    plantilla: [], 
    staff: [],
    cronologia: []
};

let jugadorSeleccionadoId = null;
let titularesSeleccionados = [];
let desconvocadosIds = [];
let staffPresentesIds = []; 
let modoEdicionEventoIndex = null;
let proximocambioPorLesion = false; 
let animandoFormacion = false;
const LIMITE_TITULARES = partidoData.modalidad === 'f7' ? 7 : 11;

const iconosStaff = {
    'mister1': '<i class="fa-solid fa-chalkboard-user"></i>',
    'mister2': '<i class="fa-solid fa-users-gear"></i>',
    'edp': '<i class="fa-solid fa-mitten"></i>',
    'pf': '<i class="fa-solid fa-dumbbell"></i>', 
    'fisio': '<i class="fa-solid fa-hand-holding-medical"></i>',
    'medico': '<i class="fa-solid fa-suitcase-medical"></i>',
    'delegado': '<i class="fa-solid fa-id-badge"></i>'
};

const nombresRolesStaff = {
    'mister1': '1º Entrenador', 'mister2': '2º Entrenador', 'pf': 'Prep. Físico',
    'edp': 'Ent. Porteros', 'fisio': 'Fisioterapeuta', 'medico': 'Médico', 'delegado': 'Delegado'
};

const ordenStaff = { 'mister1': 1, 'mister2': 2, 'edp': 3, 'pf': 4, 'fisio': 5, 'medico': 6, 'delegado': 7 };

// --- CARGA INICIAL ---
document.addEventListener('DOMContentLoaded', () => {
    const temaGuardado = localStorage.getItem('temaAtleti');
    if (temaGuardado === 'light') document.body.classList.add('light-theme');

    const equipoId = sessionStorage.getItem('equipoActivoId');
    if (!equipoId) return window.location.href = 'login.html';

    document.getElementById('categoria-info').value = partidoData.modalidad.toUpperCase();

    db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            const pData = JSON.parse(data.partidoData);
            
            if (pData.estado !== 'finalizado') {
                partidoData = pData;
                titularesSeleccionados = JSON.parse(data.titulares || '[]');
                desconvocadosIds = JSON.parse(data.desconvocados || '[]');
                staffPresentesIds = JSON.parse(data.staffPresentes || '[]');

                document.getElementById('score-atm').innerText = data.scoreAtm || '0';
                document.getElementById('score-rival').innerText = data.scoreRival || '0';
                if(data.jornada) document.getElementById('jornada-info').value = data.jornada;
                if(data.rival) document.getElementById('rival-input').value = data.rival;
                if(data.estadio) document.getElementById('estadio-input').value = data.estadio;
                if(data.fecha) document.querySelector('input[type="date"]').value = data.fecha;
                if(data.condicion) document.getElementById('btn-condicion').innerText = data.condicion;

                document.getElementById('global-status').innerText = partidoData.estado === 'previo' ? 'PREVIO' : partidoData.estado.toUpperCase().replace('_', ' ');

                renderizarJugadores();
                renderizarSuplentesDock();
                renderizarStaffDock();
                renderizarCronologia();
                restaurarBotonesEstado();

                if (partidoData.estado === 'primera_parte' || partidoData.estado === 'segunda_parte') {
                    actualizarRelojGlobal();
                }

                iniciarSincronizacionEnVivo();
            } else {
                cargarPlantillaNuevaDesdeCero(equipoId);
            }
        } else {
            cargarPlantillaNuevaDesdeCero(equipoId);
        }
    }).catch(e => {
        console.error("Error al leer la nube:", e);
        cargarPlantillaNuevaDesdeCero(equipoId);
    });
});

function cargarPlantillaNuevaDesdeCero(equipoId) {
    db.collection(`Equipos/${equipoId}/Jugadores`).get().then((snap) => {
        const rolesStaff = ['mister1', 'mister2', 'pf', 'edp', 'fisio', 'medico', 'delegado'];
        partidoData.plantilla = [];
        partidoData.staff = [];
        
        snap.forEach(doc => {
            const j = doc.data();
            j.dbId = doc.id; 
            
            if (j.id === 0 || rolesStaff.includes(j.posicion)) {
                partidoData.staff.push(j);
            } else {
                j.enCampo = false; j.minutosJugados = 0; j.tiempoEntrada = null;
                j.posX = null; j.posY = null; 
                j.lesionado = false; 
                j.stats = j.stats || { goles: 0, amarillas: 0, rojas: 0, asistencias: 0 }; 
                partidoData.plantilla.push(j);
            }
        });
        
        partidoData.plantilla.sort((a, b) => a.id - b.id);
        partidoData.staff.sort((a, b) => (ordenStaff[a.posicion] || 99) - (ordenStaff[b.posicion] || 99));
        
        abrirPanelDesconvocados();
        renderizarSuplentesDock();
        renderizarStaffDock();
        
        iniciarSincronizacionEnVivo();
        guardarEstadoNube(); 
    });
}

function iniciarSincronizacionEnVivo() {
    const equipoId = sessionStorage.getItem('equipoActivoId');
    if(!equipoId) return;

    liveMatchUnsubscribe = db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.senderId === myDeviceId) return; 
            if(partidoData.estado === 'finalizado') return; 

            partidoData = JSON.parse(data.partidoData);
            titularesSeleccionados = JSON.parse(data.titulares);
            desconvocadosIds = JSON.parse(data.desconvocados);
            staffPresentesIds = JSON.parse(data.staffPresentes);

            document.getElementById('score-atm').innerText = data.scoreAtm;
            document.getElementById('score-rival').innerText = data.scoreRival;
            document.getElementById('jornada-info').value = data.jornada;
            document.getElementById('rival-input').value = data.rival;
            document.getElementById('estadio-input').value = data.estadio;
            document.querySelector('input[type="date"]').value = data.fecha;
            document.getElementById('btn-condicion').innerText = data.condicion;

            document.getElementById('global-status').innerText = partidoData.estado === 'previo' ? 'PREVIO' : partidoData.estado.toUpperCase().replace('_', ' ');

            renderizarJugadores();
            renderizarSuplentesDock();
            renderizarStaffDock();
            renderizarCronologia();
            restaurarBotonesEstado();
        }
    });
}

function guardarEstadoNube() {
    if (partidoData.estado === 'finalizado') return; 
    const equipoId = sessionStorage.getItem('equipoActivoId');
    if(!equipoId) return;

    const payload = {
        senderId: myDeviceId, 
        partidoData: JSON.stringify(partidoData),
        titulares: JSON.stringify(titularesSeleccionados),
        desconvocados: JSON.stringify(desconvocadosIds),
        staffPresentes: JSON.stringify(staffPresentesIds),
        scoreAtm: document.getElementById('score-atm').innerText,
        scoreRival: document.getElementById('score-rival').innerText,
        jornada: document.getElementById('jornada-info').value,
        rival: document.getElementById('rival-input').value,
        estadio: document.getElementById('estadio-input').value,
        fecha: document.querySelector('input[type="date"]').value,
        condicion: document.getElementById('btn-condicion').innerText,
        timestamp: Date.now()
    };
    db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').set(payload).catch(e => console.error(e));
}

// --- GESTIÓN DE JUGADORES Y CAMPO ---

function renderizarJugadores() {
    const campo = document.getElementById('contenedor-campo'); 
    campo.innerHTML = '';
    partidoData.plantilla.forEach(j => {
        if (j.enCampo && !desconvocadosIds.includes(j.id)) {
            const node = document.createElement('div');
            node.className = 'player-node'; 
            if (animandoFormacion) node.classList.add('animating-pos');
            node.style.top = j.posY || '50%'; 
            node.style.left = j.posX || '50%';
            
            let iconosHTML = '';
            if(j.stats.goles > 0) iconosHTML += `<div class="action-icon-pitch">⚽${j.stats.goles > 1 ? 'x'+j.stats.goles : ''}</div>`;
            if(j.stats.amarillas > 0) iconosHTML += `<div class="action-icon-pitch" style="color:#F1C40F;"><i class="fa-solid fa-square"></i></div>`;
            if(j.stats.rojas > 0) iconosHTML += `<div class="action-icon-pitch" style="color:var(--atm-red);"><i class="fa-solid fa-square"></i></div>`;
            
            const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
            const imgStyle = j.foto ? `style="background-image:url('${j.foto}')" class="player-circle has-photo"` : `class="player-circle ${shirtClass}"`;
            
            node.innerHTML = `
                <div ${imgStyle}>${j.foto ? '' : j.id}</div>
                <span class="player-name">${j.alias}</span>
                <span class="player-time" id="time-${j.id}">${formatearTiempoSec(j.minutosJugados)}</span>
                <div class="indicators">${iconosHTML}</div>
            `;
            habilitarDrag(node, j); 
            campo.appendChild(node);
        }
    });
}

function habilitarDrag(el, j) {
    let isDragging = false; let moved = false; let startX, startY, initialX, initialY;
    const onMove = e => {
        if (!isDragging) return;
        const x = e.clientX || e.touches?.[0].clientX; 
        const y = e.clientY || e.touches?.[0].clientY;
        if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) moved = true;
        if (moved) e.preventDefault(); 
        const cont = document.getElementById('contenedor-campo-padre').getBoundingClientRect();
        el.style.left = `${((initialX + (x - startX)) / cont.width) * 100}%`;
        el.style.top = `${((initialY + (y - startY)) / cont.height) * 100}%`;
    };
    const onUp = e => {
        if (!isDragging) return;
        isDragging = false; el.style.zIndex = '';
        document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp);
        if (partidoData.estado === 'previo') {
            const pitch = document.getElementById('contenedor-campo-padre').getBoundingClientRect();
            const x = e.clientX || e.changedTouches?.[0].clientX;
            const y = e.clientY || e.changedTouches?.[0].clientY;
            if (x < pitch.left || x > pitch.right || y < pitch.top || y > pitch.bottom) {
                j.enCampo = false; j.posX = null; j.posY = null;
                titularesSeleccionados = titularesSeleccionados.filter(id => Number(id) !== Number(j.id));
                renderizarJugadores(); renderizarSuplentesDock(); restaurarBotonesEstado(); guardarEstadoNube();
                return;
            }
        }
        j.posX = el.style.left; j.posY = el.style.top; guardarEstadoNube(); 
    };
    el.addEventListener('pointerdown', e => {
        el.classList.remove('animating-pos'); isDragging = true; moved = false;
        startX = e.clientX || e.touches?.[0].clientX; startY = e.clientY || e.touches?.[0].clientY;
        initialX = el.offsetLeft; initialY = el.offsetTop; el.style.zIndex = 100;
        document.addEventListener('pointermove', onMove, {passive: false}); document.addEventListener('pointerup', onUp);
    });
    el.addEventListener('click', e => { if(!moved) abrirRadialMenu(j.id, el); });
}

function renderizarSuplentesDock() {
    const cont = document.getElementById('dock-suplentes'); 
    cont.innerHTML = '';
    const suplentes = partidoData.plantilla.filter(j => !j.enCampo && !desconvocadosIds.includes(j.id));
    cont.style.display = suplentes.length ? 'flex' : 'none';
    suplentes.forEach(j => {
        const div = document.createElement('div'); div.className = 'sub-miniature';
        const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
        const imgStyle = j.foto ? `style="background-image:url('${j.foto}')" class="sub-shirt has-photo"` : `class="sub-shirt ${shirtClass}"`;
        div.innerHTML = `<div ${imgStyle}>${j.foto ? '' : j.id}</div><span class="sub-name">${j.alias}</span><span class="sub-time">(${formatearTiempoSec(j.minutosJugados)})</span>`;
        habilitarDragBanquillo(div, j); 
        cont.appendChild(div);
    });
}

function habilitarDragBanquillo(el, j) {
    let isDragging = false; let moved = false; let ghost = null; let startX, startY;
    const onMove = e => {
        if (!isDragging || !ghost) return;
        const x = e.clientX || e.touches?.[0].clientX; const y = e.clientY || e.touches?.[0].clientY;
        if (!moved && (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5)) moved = true;
        if (moved) { e.preventDefault(); ghost.style.left = (x - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (y - ghost.offsetHeight / 2) + 'px'; }
    };
    const onUp = e => {
        if (!isDragging) return;
        isDragging = false; document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp);
        if (ghost) { ghost.remove(); ghost = null; }
        if (moved && partidoData.estado === 'previo') {
            const x = e.clientX || e.changedTouches?.[0].clientX;
            const y = e.clientY || e.changedTouches?.[0].clientY;
            const pitch = document.getElementById('contenedor-campo-padre').getBoundingClientRect();
            if (x >= pitch.left && x <= pitch.right && y >= pitch.top && y <= pitch.bottom) {
                const enCampoCount = partidoData.plantilla.filter(p => p.enCampo).length;
                if (enCampoCount < LIMITE_TITULARES) {
                    j.enCampo = true; if(!titularesSeleccionados.includes(j.id)) titularesSeleccionados.push(j.id);
                    j.posX = ((x - pitch.left) / pitch.width) * 100 + '%'; j.posY = ((y - pitch.top) / pitch.height) * 100 + '%';
                    renderizarJugadores(); renderizarSuplentesDock(); restaurarBotonesEstado(); guardarEstadoNube();
                } else { alert(`Límite alcanzado (${LIMITE_TITULARES})`); }
            }
        }
        moved = false;
    };
    el.addEventListener('pointerdown', e => {
        if (partidoData.estado !== 'previo') return; 
        isDragging = true; moved = false;
        startX = e.clientX || e.touches?.[0].clientX; startY = e.clientY || e.touches?.[0].clientY;
        ghost = el.cloneNode(true); ghost.style.position = 'fixed'; ghost.style.zIndex = 9999; ghost.style.pointerEvents = 'none';
        const rect = el.getBoundingClientRect(); ghost.style.left = rect.left + 'px'; ghost.style.top = rect.top + 'px';
        document.body.appendChild(ghost);
        document.addEventListener('pointermove', onMove, {passive: false}); document.addEventListener('pointerup', onUp);
    });
    el.addEventListener('click', e => {
        if (moved) return;
        if(document.getElementById('radial-overlay').classList.contains('active') && jugadorSeleccionadoId) ejecutarCambio(jugadorSeleccionadoId, j.id);
    });
}

// --- ACCIONES Y CRONOLOGÍA ---

function ejecutarCambio(idSale, idEntra) {
    const ahora = Date.now();
    const jSale = partidoData.plantilla.find(j => j.id === idSale);
    const jEntra = partidoData.plantilla.find(j => j.id === idEntra);
    
    if(jSale.tiempoEntrada) jSale.minutosJugados += Math.floor((ahora - jSale.tiempoEntrada) / 1000);
    jSale.enCampo = false; jSale.tiempoEntrada = null;
    jEntra.enCampo = true; jEntra.posX = jSale.posX; jEntra.posY = jSale.posY; 
    if(partidoData.estado.includes('parte')) jEntra.tiempoEntrada = ahora;
    
    titularesSeleccionados = titularesSeleccionados.filter(id => Number(id) !== Number(idSale));
    if(!titularesSeleccionados.includes(jEntra.id)) titularesSeleccionados.push(jEntra.id);

    const icono = proximocambioPorLesion ? '🔄🚑' : '🔄';
    const desc = proximocambioPorLesion ? `Entra ${jEntra.alias} por ${jSale.alias} (Lesión)` : `Entra ${jEntra.alias} por ${jSale.alias}`;
    
    registrarEnCronologia(`Cambio`, desc, icono, null, {tipo:'cambio', saleId: idSale, entraId: idEntra});
    proximocambioPorLesion = false; 
    cerrarModal(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
}

function registrarEnCronologia(tipo, desc, icono="", minOpcional=null, metaObj={}) {
    const minFinal = minOpcional || obtenerMinutoGlobal();
    partidoData.cronologia.push({minuto: minFinal, tipo: tipo, descripcion: desc, icono: icono, meta: metaObj});
    renderizarCronologia();
    guardarEstadoNube();
}

function renderizarCronologia() {
    const list = document.getElementById('lista-cronologia'); 
    list.innerHTML = '';
    if(partidoData.cronologia.length === 0) { document.getElementById('crono-on-pitch').style.display = 'none'; return; }
    document.getElementById('crono-on-pitch').style.display = 'flex';
    [...partidoData.cronologia].reverse().forEach((e) => {
        list.innerHTML += `
            <li class="crono-item">
                <div class="crono-left">
                    <span class="crono-min">${e.minuto}</span>
                    <span class="crono-icon">${e.icono}</span>
                    <div><strong>${e.tipo}</strong><br><small>${e.descripcion}</small></div>
                </div>
            </li>`;
    });
}

// --- EXPORTACIÓN PDF ---

window.exportarPDF = function() {
    const element = document.getElementById('pdf-content');
    const rival = document.getElementById('rival-input').value || 'Rival';
    
    document.getElementById('pdf-fecha').innerText = document.querySelector('input[type="date"]').value;
    document.getElementById('pdf-score-atm').innerText = document.getElementById('score-atm').innerText;
    document.getElementById('pdf-score-rival').innerText = document.getElementById('score-rival').innerText;
    document.getElementById('pdf-rival-name').innerText = rival;
    document.getElementById('pdf-match-status').innerText = document.getElementById('global-status').innerText;
    document.getElementById('pdf-cat').innerText = document.getElementById('categoria-info').value;
    document.getElementById('pdf-jor').innerText = document.getElementById('jornada-info').value;
    document.getElementById('pdf-cam').innerText = document.getElementById('estadio-input').value;
    document.getElementById('pdf-con').innerText = document.getElementById('btn-condicion').innerText;

    const tTit = document.getElementById('pdf-tbody-titulares'); tTit.innerHTML = '';
    partidoData.plantilla.filter(j => j.enCampo).forEach(j => {
        const tr = document.createElement('tr'); tr.className = "pdf-row";
        tr.innerHTML = `<td style="padding:8px;text-align:center;">${j.id}</td><td style="padding:8px;">${j.alias}</td><td style="padding:8px;text-align:center;">${j.posicion.substring(0,3)}</td><td style="padding:8px;text-align:center;">${formatearTiempoSec(j.minutosJugados)}</td><td style="padding:8px;text-align:center;">${j.stats.goles||'-'}</td><td style="padding:8px;text-align:center;">${j.stats.amarillas||'-'}</td><td style="padding:8px;text-align:center;">${j.stats.asistencias||'-'}</td>`;
        tTit.appendChild(tr);
    });

    const tSup = document.getElementById('pdf-tbody-suplentes'); tSup.innerHTML = '';
    partidoData.plantilla.filter(j => !j.enCampo && !desconvocadosIds.includes(j.id)).forEach(j => {
        const tr = document.createElement('tr'); tr.className = "pdf-row";
        tr.innerHTML = `<td style="padding:8px;text-align:center;">${j.id}</td><td style="padding:8px;">${j.alias}</td><td style="padding:8px;text-align:center;">${j.posicion.substring(0,3)}</td><td style="padding:8px;text-align:center;">${formatearTiempoSec(j.minutosJugados)}</td><td style="padding:8px;text-align:center;">${j.stats.goles||'-'}</td><td style="padding:8px;text-align:center;">${j.stats.amarillas||'-'}</td><td style="padding:8px;text-align:center;">${j.stats.asistencias||'-'}</td>`;
        tSup.appendChild(tr);
    });

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Reporte_ATM_vs_${rival}.pdf`,
        pagebreak: { mode: ['css', 'avoid-all'], avoid: ['.pdf-row', 'h2', 'tr'] },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 790, onclone: (cloned) => { cloned.getElementById('pdf-wrapper').style.visibility = 'visible'; } },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
};

// --- RESTO DE FUNCIONES (Siguen intactas en tu archivo) ---
function obtenerMinutoGlobal() {
    if(partidoData.estado === 'previo') return "0'";
    if(partidoData.estado === 'finalizado') return "Fin";
    let base = partidoData.estado === 'segunda_parte' ? Math.floor(partidoData.segundosAcumuladosPrimera / 60) : 0;
    return `${base + Math.floor((Date.now() - partidoData.inicioPeriodoTimestamp) / 60000)}'`;
}

window.cerrarRadial = () => document.getElementById('radial-overlay').classList.remove('active');
window.cerrarModal = () => { document.querySelectorAll('.overlay').forEach(m => m.classList.remove('active')); modoEdicionEventoIndex = null; };

window.compartirPartido = function() {
    const id = sessionStorage.getItem('equipoActivoId'); if(!id) return;
    const shareUrl = `${window.location.href.split('index.html')[0]}live.html?id=${id}`;
    document.getElementById('share-url-input').value = shareUrl;
    document.getElementById('modal-compartir').classList.add('active');
};
window.copyShareUrl = () => { const input = document.getElementById('share-url-input'); input.select(); document.execCommand('copy'); alert("Copiado."); };