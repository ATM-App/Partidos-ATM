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

window.addEventListener('beforeunload', function (e) {
    if (partidoData.estado === 'primera_parte' || partidoData.estado === 'segunda_parte' || partidoData.estado === 'descanso') {
        e.preventDefault();
        e.returnValue = '¿Seguro?';
    }
});

function restaurarBotonesEstado() {
    document.querySelectorAll('.dock-btn, .ios-dock-btn').forEach(b => b.classList.remove('active'));
    if (partidoData.estado === 'primera_parte') document.getElementById('btn-estado-partido').classList.add('active');
    else if (partidoData.estado === 'descanso') document.querySelector('.ios-dock-btn[onclick*="descanso"]')?.classList.add('active');
    else if (partidoData.estado === 'segunda_parte') document.querySelector('.ios-dock-btn[onclick*="segunda_parte"]')?.classList.add('active');
    else if (partidoData.estado === 'finalizado') document.querySelector('.ios-dock-btn[onclick*="finalizado"]')?.classList.add('active');
    
    const btnIniciar = document.getElementById('btn-estado-partido');
    if (partidoData.estado === 'previo') {
        const enCampo = partidoData.plantilla.filter(j => j.enCampo).length;
        btnIniciar.style.opacity = (enCampo === LIMITE_TITULARES) ? '1' : '0.4';
    } else { btnIniciar.style.opacity = '1'; }

    const locked = partidoData.estado !== 'previo';
    document.getElementById('btn-titulares')?.classList.toggle('locked', locked);
    document.getElementById('btn-desconvocados')?.classList.toggle('locked', locked);
    document.getElementById('btn-staff')?.classList.toggle('locked', locked);
}

window.toggleTema = function() {
    document.body.classList.toggle('light-theme');
    localStorage.setItem('temaAtleti', document.body.classList.contains('light-theme') ? 'light' : 'dark');
};

window.salirApp = function() {
    if (partidoData.estado !== 'previo' && partidoData.estado !== 'finalizado') {
        if(!confirm("¿Salir de la sesión?")) return;
    }
    sessionStorage.removeItem('equipoActivoId');
    window.location.href = 'login.html';
};

window.toggleDockLabels = () => document.getElementById('sidebar').classList.toggle('show-labels');

window.toggleCondicion = function() {
    const btn = document.getElementById('btn-condicion');
    btn.innerText = btn.innerText.includes('Local') ? '✈️ Visitante' : '🏠 Local';
    guardarEstadoNube();
};

window.selectPill = function(inputId, btnEl, value) {
    btnEl.closest('.pill-group').querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    document.getElementById(inputId).value = value;
};

window.abrirModalStaff = function() {
    if (partidoData.estado !== 'previo') return alert("No modificable una vez iniciado.");
    document.getElementById('modal-staff').classList.add('active');
    renderizarSeleccionStaff();
};

function renderizarSeleccionStaff() {
    const cont = document.getElementById('lista-seleccion-staff'); 
    cont.innerHTML = '';
    partidoData.staff.forEach(s => {
        const estaPresente = staffPresentesIds.includes(s.dbId);
        const div = document.createElement('div');
        div.className = `list-item-dense ${estaPresente ? 'selected' : ''}`;
        div.innerHTML = `<div><strong>${s.alias}</strong><br><small>${nombresRolesStaff[s.posicion] || s.posicion}</small></div><div>${estaPresente ? '✅' : '⚪'}</div>`;
        div.onclick = () => {
            if(estaPresente) staffPresentesIds = staffPresentesIds.filter(id => id !== s.dbId);
            else staffPresentesIds.push(s.dbId);
            renderizarSeleccionStaff(); renderizarStaffDock(); guardarEstadoNube();
        };
        cont.appendChild(div);
    });
}

function renderizarStaffDock() {
    const cont = document.getElementById('dock-staff'); 
    cont.innerHTML = '';
    const presentes = partidoData.staff.filter(s => staffPresentesIds.includes(s.dbId));
    cont.style.display = presentes.length ? 'flex' : 'none';
    presentes.forEach(s => {
        const div = document.createElement('div'); div.className = 'sub-miniature';
        const img = s.foto ? `style="background-image:url('${s.foto}')" class="sub-shirt has-photo"` : `class="sub-shirt"`;
        div.innerHTML = `<div ${img}>${s.foto ? '' : (iconosStaff[s.posicion] || '👤')}</div><span class="sub-name">${s.alias}</span>`;
        cont.appendChild(div);
    });
}

window.abrirModalFormaciones = function() {
    cerrarRadial();
    document.getElementById(partidoData.modalidad === 'f7' ? 'formaciones-f7' : 'formaciones-f11').style.display = 'block';
    document.getElementById(partidoData.modalidad === 'f7' ? 'formaciones-f11' : 'formaciones-f7').style.display = 'none';
    document.getElementById('modal-formaciones').classList.add('active');
};

window.aplicarFormacion = function(tipo) {
    const enCampo = partidoData.plantilla.filter(j => j.enCampo && !desconvocadosIds.includes(j.id));
    if (!enCampo.length) return alert("Selecciona titulares.");
    const roles = { 'portero': 1, 'defensa': 2, 'medio': 3, 'delantero': 4 };
    enCampo.sort((a, b) => roles[a.posicion] - roles[b.posicion] || a.id - b.id);
    let pos = [];
    if (partidoData.modalidad === 'f11') {
        if (tipo === '4-4-2') pos = [{top:'50%',left:'8%'}, {top:'20%',left:'25%'},{top:'40%',left:'22%'},{top:'60%',left:'22%'},{top:'80%',left:'25%'}, {top:'20%',left:'50%'},{top:'40%',left:'48%'},{top:'60%',left:'48%'},{top:'80%',left:'50%'}, {top:'40%',left:'75%'},{top:'60%',left:'75%'}];
        else if (tipo === '4-3-3') pos = [{top:'50%',left:'8%'}, {top:'20%',left:'25%'},{top:'40%',left:'22%'},{top:'60%',left:'22%'},{top:'80%',left:'25%'}, {top:'50%',left:'45%'},{top:'30%',left:'50%'},{top:'70%',left:'50%'}, {top:'20%',left:'75%'},{top:'50%',left:'80%'},{top:'80%',left:'75%'}];
        else if (tipo === '3-5-2') pos = [{top:'50%',left:'8%'}, {top:'30%',left:'22%'},{top:'50%',left:'20%'},{top:'70%',left:'22%'}, {top:'15%',left:'50%'},{top:'35%',left:'45%'},{top:'50%',left:'48%'},{top:'65%',left:'45%'},{top:'85%',left:'50%'}, {top:'40%',left:'75%'},{top:'60%',left:'75%'}];
        else if (tipo === '4-2-3-1') pos = [{top:'50%',left:'8%'}, {top:'20%',left:'25%'},{top:'40%',left:'22%'},{top:'60%',left:'22%'},{top:'80%',left:'25%'}, {top:'40%',left:'45%'},{top:'60%',left:'45%'}, {top:'20%',left:'65%'},{top:'50%',left:'60%'},{top:'80%',left:'65%'}, {top:'50%',left:'80%'}];
        else if (tipo === '5-3-2') pos = [{top:'50%',left:'8%'}, {top:'15%',left:'25%'},{top:'32.5%',left:'22%'},{top:'50%',left:'20%'},{top:'67.5%',left:'22%'},{top:'85%',left:'25%'}, {top:'25%',left:'45%'},{top:'50%',left:'45%'},{top:'75%',left:'45%'}, {top:'40%',left:'75%'},{top:'60%',left:'75%'}];
        else if (tipo === '4-1-4-1') pos = [{top:'50%',left:'8%'}, {top:'20%',left:'25%'},{top:'40%',left:'22%'},{top:'60%',left:'22%'},{top:'80%',left:'25%'}, {top:'50%',left:'35%'}, {top:'20%',left:'50%'},{top:'40%',left:'48%'},{top:'60%',left:'48%'},{top:'80%',left:'50%'}, {top:'50%',left:'80%'}];
        else if (tipo === '3-4-3') pos = [{top:'50%',left:'8%'}, {top:'25%',left:'22%'},{top:'50%',left:'20%'},{top:'75%',left:'22%'}, {top:'20%',left:'50%'},{top:'40%',left:'45%'},{top:'60%',left:'45%'},{top:'80%',left:'50%'}, {top:'25%',left:'75%'},{top:'50%',left:'80%'},{top:'75%',left:'75%'}];
    } else {
        if (tipo === '3-2-1') pos = [{top:'50%',left:'10%'}, {top:'25%',left:'30%'},{top:'50%',left:'28%'},{top:'75%',left:'30%'}, {top:'35%',left:'55%'},{top:'65%',left:'55%'}, {top:'50%',left:'75%'}];
        else if (tipo === '2-3-1') pos = [{top:'50%',left:'10%'}, {top:'35%',left:'30%'},{top:'65%',left:'30%'}, {top:'20%',left:'55%'},{top:'50%',left:'50%'},{top:'80%',left:'55%'}, {top:'50%',left:'75%'}];
        else if (tipo === '3-1-2') pos = [{top:'50%',left:'10%'}, {top:'25%',left:'30%'},{top:'50%',left:'28%'},{top:'75%',left:'30%'}, {top:'50%',left:'55%'}, {top:'35%',left:'75%'},{top:'65%',left:'75%'}];
        else if (tipo === '2-2-2') pos = [{top:'50%',left:'10%'}, {top:'30%',left:'30%'},{top:'70%',left:'30%'}, {top:'30%',left:'55%'},{top:'70%',left:'55%'}, {top:'35%',left:'80%'},{top:'65%',left:'80%'}];
        else if (tipo === '1-3-2') pos = [{top:'50%',left:'10%'}, {top:'50%',left:'28%'}, {top:'20%',left:'50%'},{top:'50%',left:'45%'},{top:'80%',left:'50%'}, {top:'35%',left:'75%'},{top:'65%',left:'75%'}];
        else if (tipo === '2-1-3') pos = [{top:'50%',left:'10%'}, {top:'30%',left:'30%'},{top:'70%',left:'30%'}, {top:'50%',left:'50%'}, {top:'20%',left:'75%'},{top:'50%',left:'80%'},{top:'80%',left:'75%'}];
    }
    enCampo.forEach((j, idx) => { if (pos[idx]) { j.posX = pos[idx].left; j.posY = pos[idx].top; } });
    animandoFormacion = true; renderizarJugadores(); cerrarModal();
    setTimeout(() => { animandoFormacion = false; renderizarJugadores(); guardarEstadoNube(); }, 600);
}

window.registrarLesion = function() {
    const j = partidoData.plantilla.find(p => p.id === jugadorSeleccionadoId);
    j.lesionado = true; registrarEnCronologia("Lesión", `Asistencia: ${j.alias}`, '🚑');
    proximocambioPorLesion = true; cerrarRadial(); setTimeout(mostrarBanquillo, 400); 
};

window.abrirAmarillaRival = function() {
    if (partidoData.estado === 'previo') return alert("⚠️ Inicia el partido.");
    cerrarRadial(); document.getElementById('modal-amarilla-rival').classList.add('active');
};

window.confirmarAmarillaRival = function() {
    const n = document.getElementById('num-rival-amarilla').value;
    if(!n) return; registrarEnCronologia("Amarilla Rival", `#${n}`, '🟨🔸'); cerrarModal();
};

function formatearTiempoSec(seg) {
    if (!seg) return "00:00";
    return `${Math.floor(seg/60).toString().padStart(2,'0')}:${(seg%60).toString().padStart(2,'0')}`;
}

window.abrirModalAlineacion = function() {
    if (partidoData.estado !== 'previo') return;
    document.getElementById('desconvocados-modal').classList.remove('active');
    document.getElementById('lineup-modal').classList.add('active');
    renderizarListaSeleccionTitulares();
};

window.abrirPanelDesconvocados = function() {
    if (partidoData.estado !== 'previo') return;
    document.getElementById('lineup-modal').classList.remove('active');
    document.getElementById('desconvocados-modal').classList.add('active');
    const cont = document.getElementById('lista-desconvocados'); cont.innerHTML = '';
    partidoData.plantilla.forEach(j => {
        const esDesc = desconvocadosIds.includes(j.id);
        const div = document.createElement('div');
        div.className = `list-item-dense ${esDesc ? 'selected' : ''}`;
        const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
        const img = j.foto ? `style="background-image:url('${j.foto}')" class="sub-shirt has-photo"` : `class="sub-shirt ${shirtClass}"`;
        div.innerHTML = `<div style="display:flex; align-items:center;"><div ${img} style="width:30px;height:30px;margin-right:10px">${j.foto?'':j.id}</div><div><strong>${j.id}</strong> - ${j.alias}</div></div><div>${esDesc ? '🚫' : '⚪'}</div>`;
        div.onclick = () => {
            if(esDesc) desconvocadosIds = desconvocadosIds.filter(id => id !== j.id);
            else { 
                desconvocadosIds.push(j.id); 
                titularesSeleccionados = titularesSeleccionados.filter(id => Number(id) !== Number(j.id)); 
                j.enCampo = false; 
            }
            abrirPanelDesconvocados(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
        };
        cont.appendChild(div);
    });
};

window.cerrarModalDesconvocados = () => { document.getElementById('desconvocados-modal').classList.remove('active'); abrirModalAlineacion(); };

function renderizarListaSeleccionTitulares() {
    const contenedor = document.getElementById('lista-seleccion-titulares'); contenedor.innerHTML = '';
    document.getElementById('titulares-count').innerText = titularesSeleccionados.length;
    document.getElementById('btn-confirmar-alineacion').disabled = titularesSeleccionados.length !== LIMITE_TITULARES;
    partidoData.plantilla.forEach(j => {
        if(desconvocadosIds.includes(j.id)) return; 
        const sel = titularesSeleccionados.includes(j.id);
        const div = document.createElement('div');
        div.className = `list-item-dense ${sel ? 'selected' : ''}`;
        const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
        const img = j.foto ? `style="background-image:url('${j.foto}')" class="sub-shirt has-photo"` : `class="sub-shirt ${shirtClass}"`;
        div.innerHTML = `<div style="display:flex; align-items:center;"><div ${img} style="width:30px;height:30px;margin-right:10px">${j.foto?'':j.id}</div><div><strong>${j.id}</strong> - ${j.alias}</div></div><div>${sel ? '✅' : '⚪'}</div>`;
        div.onclick = () => {
            if (sel) titularesSeleccionados = titularesSeleccionados.filter(id => Number(id) !== Number(j.id));
            else if (titularesSeleccionados.length < LIMITE_TITULARES) titularesSeleccionados.push(j.id);
            renderizarListaSeleccionTitulares();
        };
        contenedor.appendChild(div);
    });
}

function confirmarAlineacionInicial() {
    partidoData.plantilla.forEach(j => { j.enCampo = titularesSeleccionados.includes(j.id); });
    document.getElementById('lineup-modal').classList.remove('active');
    renderizarJugadores(); renderizarSuplentesDock(); restaurarBotonesEstado(); guardarEstadoNube();
}

function renderizarJugadores() {
    const campo = document.getElementById('contenedor-campo'); campo.innerHTML = '';
    partidoData.plantilla.forEach(j => {
        if (j.enCampo && !desconvocadosIds.includes(j.id)) {
            const node = document.createElement('div');
            node.className = 'player-node'; 
            if (animandoFormacion) node.classList.add('animating-pos');
            node.style.top = j.posY || '50%'; node.style.left = j.posX || '50%';
            let iconosHTML = '';
            if(j.stats.goles > 0) iconosHTML += `<div class="action-icon-pitch">⚽${j.stats.goles > 1 ? 'x'+j.stats.goles : ''}</div>`;
            if(j.stats.amarillas > 0) iconosHTML += `<div class="action-icon-pitch" style="color:#F1C40F;"><i class="fa-solid fa-square"></i></div>`;
            if(j.stats.rojas > 0) iconosHTML += `<div class="action-icon-pitch" style="color:var(--atm-red);"><i class="fa-solid fa-square"></i></div>`;
            const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
            const img = j.foto ? `style="background-image:url('${j.foto}')" class="player-circle has-photo"` : `class="player-circle ${shirtClass}"`;
            node.innerHTML = `<div ${img}>${j.foto?'':j.id}</div><span class="player-name">${j.alias}</span><span class="player-time" id="time-${j.id}">${formatearTiempoSec(j.minutosJugados)}</span><div class="indicators">${iconosHTML}</div>`;
            habilitarDrag(node, j); campo.appendChild(node);
        }
    });
}

function habilitarDrag(el, j) {
    let isDragging = false; let moved = false; let startX, startY, initialX, initialY;
    const onMove = e => {
        if (!isDragging) return;
        const x = e.clientX || e.touches?.[0].clientX; const y = e.clientY || e.touches?.[0].clientY;
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
            const x = e.clientX || e.changedTouches?.[0].clientX; const y = e.clientY || e.changedTouches?.[0].clientY;
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
    const cont = document.getElementById('dock-suplentes'); cont.innerHTML = '';
    const suplentes = partidoData.plantilla.filter(j => !j.enCampo && !desconvocadosIds.includes(j.id));
    cont.style.display = suplentes.length ? 'flex' : 'none';
    suplentes.forEach(j => {
        const div = document.createElement('div'); div.className = 'sub-miniature';
        const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
        const img = j.foto ? `style="background-image:url('${j.foto}')" class="sub-shirt has-photo"` : `class="sub-shirt ${shirtClass}"`;
        div.innerHTML = `<div ${img}>${j.foto?'':j.id}</div><span class="sub-name">${j.alias}</span><span class="sub-time">(${formatearTiempoSec(j.minutosJugados)})</span>`;
        habilitarDragBanquillo(div, j); cont.appendChild(div);
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
            const x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const y = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            const pitch = document.getElementById('contenedor-campo-padre').getBoundingClientRect();
            if (x >= pitch.left && x <= pitch.right && y >= pitch.top && y <= pitch.bottom) {
                const enCampoCount = partidoData.plantilla.filter(p => p.enCampo).length;
                if (enCampoCount < LIMITE_TITULARES) {
                    j.enCampo = true; if(!titularesSeleccionados.includes(j.id)) titularesSeleccionados.push(j.id);
                    j.posX = ((x - pitch.left) / pitch.width) * 100 + '%'; j.posY = ((y - pitch.top) / pitch.height) * 100 + '%';
                    renderizarJugadores(); renderizarSuplentesDock(); restaurarBotonesEstado(); guardarEstadoNube();
                } else { alert(`Límite ${LIMITE_TITULARES}`); }
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

function actualizarRelojGlobal() {
    if (partidoData.estado !== 'primera_parte' && partidoData.estado !== 'segunda_parte') return;
    const ahora = Date.now();
    let segVisuales = Math.floor((ahora - partidoData.inicioPeriodoTimestamp) / 1000); 
    document.getElementById('global-timer').innerText = formatearTiempoSec(segVisuales);
    partidoData.plantilla.forEach(j => {
        if (j.enCampo && j.tiempoEntrada) {
            const segInd = j.minutosJugados + Math.floor((ahora - j.tiempoEntrada) / 1000); 
            const dom = document.getElementById(`time-${j.id}`); if(dom) dom.innerText = formatearTiempoSec(segInd);
        }
    });
    requestAnimationFrame(actualizarRelojGlobal);
}

window.cambiarEstadoPartido = function(nuevoEstado) {
    const statusDom = document.getElementById('global-status'); const ahora = Date.now();
    if (nuevoEstado === 'primera_parte' && partidoData.estado === 'previo') {
        const enCampo = partidoData.plantilla.filter(j => j.enCampo).length;
        if(enCampo !== LIMITE_TITULARES) return alert(`Alineación incompleta (${enCampo}/${LIMITE_TITULARES})`);
        partidoData.estado = 'primera_parte'; partidoData.inicioPeriodoTimestamp = ahora;
        partidoData.plantilla.forEach(j => { if(j.enCampo) j.tiempoEntrada = ahora; });
        statusDom.innerText = '1ª PARTE'; restaurarBotonesEstado();
        registrarEnCronologia("Inicio", "Comienza 1º Tiempo", '▶️', "0'", {tipo:'estado'});
        actualizarRelojGlobal(); document.getElementById('crono-on-pitch').style.display = 'flex'; guardarEstadoNube();
    } 
    else if(nuevoEstado === 'descanso' && partidoData.estado === 'primera_parte') {
        partidoData.estado = 'descanso'; 
        partidoData.segundosAcumuladosPrimera = Math.floor((ahora - partidoData.inicioPeriodoTimestamp) / 1000);
        partidoData.plantilla.forEach(j => { if(j.enCampo && j.tiempoEntrada){ j.minutosJugados += Math.floor((ahora-j.tiempoEntrada)/1000); j.tiempoEntrada = null;} });
        statusDom.innerText = 'DESCANSO'; restaurarBotonesEstado();
        registrarEnCronologia("Descanso", "Fin 1º Tiempo", '⏸️', `${Math.floor(partidoData.segundosAcumuladosPrimera/60)}'`, {tipo:'estado'});
        guardarEstadoNube();
    }
    else if(nuevoEstado === 'segunda_parte' && partidoData.estado === 'descanso') {
        partidoData.estado = 'segunda_parte'; partidoData.inicioPeriodoTimestamp = ahora; 
        partidoData.plantilla.forEach(j => { if(j.enCampo) j.tiempoEntrada = ahora; });
        statusDom.innerText = '2ª PARTE'; restaurarBotonesEstado();
        registrarEnCronologia("Reinicio", "Comienza 2º Tiempo", '▶️', `${Math.floor(partidoData.segundosAcumuladosPrimera/60)}'`, {tipo:'estado'});
        actualizarRelojGlobal(); guardarEstadoNube();
    }
    else if(nuevoEstado === 'finalizado') {
        partidoData.estado = 'finalizado';
        partidoData.plantilla.forEach(j => { if(j.enCampo && j.tiempoEntrada){ j.minutosJugados += Math.floor((ahora-j.tiempoEntrada)/1000); j.tiempoEntrada = null;} });
        statusDom.innerText = 'FINALIZADO'; restaurarBotonesEstado();
        registrarEnCronologia("Final", "Partido Terminado", '🏁', "Fin", {tipo:'estado'});
        const equipoId = sessionStorage.getItem('equipoActivoId');
        setTimeout(() => { exportarPDF(); }, 500);
        setTimeout(() => {
            const jornada = document.getElementById('jornada-info').value;
            const rival = document.getElementById('rival-input').value || 'Rival';
            const payloadGuardado = {
                nombre: `Jornada ${jornada} - ${rival}`, jornada, rival,
                fecha: document.querySelector('input[type="date"]').value,
                partidoData: JSON.stringify(partidoData),
                titulares: JSON.stringify(titularesSeleccionados),
                desconvocados: JSON.stringify(desconvocadosIds),
                staffPresentes: JSON.stringify(staffPresentesIds),
                scoreAtm: document.getElementById('score-atm').innerText,
                scoreRival: document.getElementById('score-rival').innerText,
                timestamp: Date.now()
            };
            db.collection(`Equipos/${equipoId}/PartidosGuardados`).add(payloadGuardado).then(() => {
                db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').delete();
                alert("✅ Guardado.");
            });
        }, 2500);
    }
};

function obtenerMinutoGlobal() {
    if(partidoData.estado === 'previo') return "0'";
    if(partidoData.estado === 'descanso') return `${Math.floor(partidoData.segundosAcumuladosPrimera / 60)}'`;
    if(partidoData.estado === 'finalizado') return "Fin";
    let base = partidoData.estado === 'segunda_parte' ? Math.floor(partidoData.segundosAcumuladosPrimera / 60) : 0;
    return `${base + Math.floor((Date.now() - partidoData.inicioPeriodoTimestamp) / 60000)}'`;
}

window.abrirRadialMenu = function(id, elDOM) {
    if (partidoData.estado === 'previo') return alert("⚠️ Inicia el partido.");
    jugadorSeleccionadoId = id; const menu = document.getElementById('radial-menu'); const rect = elDOM.getBoundingClientRect();
    menu.style.position = 'fixed'; menu.style.left = `${rect.left + rect.width / 2}px`; menu.style.top = `${rect.top + rect.height / 2}px`;
    document.getElementById('radial-overlay').classList.add('active');
};

window.cerrarRadial = () => document.getElementById('radial-overlay').classList.remove('active');
window.cerrarModal = () => { document.querySelectorAll('.overlay').forEach(m => m.classList.remove('active')); modoEdicionEventoIndex = null; };

window.mostrarBanquillo = function() {
    cerrarRadial(); const sale = partidoData.plantilla.find(j => j.id === jugadorSeleccionadoId);
    document.getElementById('texto-jugador-sale').innerText = sale.alias;
    const cont = document.getElementById('lista-banquillo-cambio'); cont.innerHTML = '';
    const suplentes = partidoData.plantilla.filter(j => !j.enCampo && !desconvocadosIds.includes(j.id));
    suplentes.forEach(j => {
        const btn = document.createElement('div'); btn.className = 'list-item-dense';
        const shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';
        const img = j.foto ? `style="background-image:url('${j.foto}')" class="sub-shirt has-photo"` : `class="sub-shirt ${shirtClass}"`;
        btn.innerHTML = `<div style="display:flex; align-items:center;"><div ${img}>${j.foto?'':j.id}</div><div><strong>${j.id}</strong> - ${j.alias}<br><small>(${formatearTiempoSec(j.minutosJugados)})</small></div></div><i class="fa-solid fa-arrow-up" style="color:#3498DB;"></i>`;
        btn.onclick = () => ejecutarCambio(jugadorSeleccionadoId, j.id);
        cont.appendChild(btn);
    });
    document.getElementById('modal-banquillo').classList.add('active');
};

function ejecutarCambio(idSale, idEntra) {
    const ahora = Date.now();
    const jSale = partidoData.plantilla.find(j => j.id === idSale);
    const jEntra = partidoData.plantilla.find(j => j.id === idEntra);
    if(jSale.tiempoEntrada) jSale.minutosJugados += Math.floor((ahora-jSale.tiempoEntrada) / 1000);
    jSale.enCampo = false; jSale.tiempoEntrada = null;
    jEntra.enCampo = true; jEntra.posX = jSale.posX; jEntra.posY = jSale.posY; 
    if(partidoData.estado.includes('parte')) jEntra.tiempoEntrada = ahora;
    
    titularesSeleccionados = titularesSeleccionados.filter(id => Number(id) !== Number(idSale));
    if(!titularesSeleccionados.includes(jEntra.id)) titularesSeleccionados.push(jEntra.id);

    const icono = proximocambioPorLesion ? '🔄🚑' : '🔄';
    const desc = proximocambioPorLesion ? `Entra ${jEntra.alias} por ${jSale.alias} (Lesión)` : `Entra ${jEntra.alias} por ${jSale.alias}`;
    registrarEnCronologia(`Cambio`, desc, icono, null, {tipo:'cambio', saleId: idSale, entraId: idEntra});
    proximocambioPorLesion = false; cerrarModal(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
}

window.modificarGoles = (equipo, num) => { 
    if (partidoData.estado === 'previo') return alert("⚠️ Inicia el partido.");
    const dom = document.getElementById(`score-${equipo}`); dom.innerText = Math.max(0, parseInt(dom.innerText) + num);
    guardarEstadoNube();
};

window.prepararGolRival = function() {
    if (partidoData.estado === 'previo') return alert("⚠️ Inicia el partido.");
    document.getElementById('rival-gol-nombre').value = ''; document.getElementById('modal-gol-rival').classList.add('active');
};

window.confirmarGolRival = function() {
    const nom = document.getElementById('rival-gol-nombre').value || 'Jugador Rival';
    const tipo = document.getElementById('rival-tipo-gol').value;
    registrarEnCronologia(`Gol Rival (${nom})`, tipo, '⚽', null, {tipo:'gol_rival', jugador: nom});
    window.modificarGoles('rival', 1); cerrarModal(); 
};

window.prepararGol = function() {
    cerrarRadial();
    const selAsis = document.getElementById('asistencia-list'); 
    selAsis.innerHTML = `<button type="button" class="pill-btn active" onclick="selectPill('asistencia-gol', this, '')">Sin asistencia</button>`;
    partidoData.plantilla.filter(j => j.enCampo && j.id !== jugadorSeleccionadoId).forEach(j => {
        selAsis.innerHTML += `<button type="button" class="pill-btn" onclick="selectPill('asistencia-gol', this, '${j.alias}')">${j.alias}</button>`;
    });
    document.getElementById('modal-opciones-gol').classList.add('active');
};

window.confirmarGol = function() {
    const tipo = document.getElementById('tipo-gol').value; const asis = document.getElementById('asistencia-gol').value;
    const j = partidoData.plantilla.find(j => j.id === jugadorSeleccionadoId);
    j.stats.goles = (j.stats.goles || 0) + 1;
    if (asis) { const ja = partidoData.plantilla.find(p => p.alias === asis); if (ja) ja.stats.asistencias = (ja.stats.asistencias || 0) + 1; }
    window.modificarGoles('atm', 1);
    registrarEnCronologia(`Gol de ${j.alias}`, `${tipo}${asis ? ' (Asist: '+asis+')' : ''}`, '⚽', null, {tipo:'gol_atm', jugadorId: j.id}); 
    cerrarModal(); renderizarJugadores();
};

window.confirmarTarjeta = function(tipo) {
    const j = partidoData.plantilla.find(j => j.id === jugadorSeleccionadoId);
    if(tipo==='amarilla') j.stats.amarillas = (j.stats.amarillas || 0) + 1; 
    else j.stats.rojas = (j.stats.rojas || 0) + 1;
    registrarEnCronologia(`T. ${tipo==='amarilla'?'Amarilla':'Roja'} - ${j.alias}`, `Falta`, tipo==='amarilla'?'🟨':'🟥');
    if(tipo === 'roja') j.enCampo = false;
    cerrarRadial(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
};

function registrarEnCronologia(tipo, desc, icono="", minOpcional=null, metaObj={}) {
    const minFinal = minOpcional || obtenerMinutoGlobal();
    partidoData.cronologia.push({minuto: minFinal, tipo: tipo, descripcion: desc, icono: icono, meta: metaObj});
    renderizarCronologia(); guardarEstadoNube();
}

function renderizarCronologia() {
    const list = document.getElementById('lista-cronologia'); list.innerHTML = '';
    if(partidoData.cronologia.length === 0) { document.getElementById('crono-on-pitch').style.display = 'none'; return; }
    document.getElementById('crono-on-pitch').style.display = 'flex';
    [...partidoData.cronologia].reverse().forEach((e) => {
        list.innerHTML += `<li class="crono-item"><div class="crono-left"><span class="crono-min">${e.minuto}</span><span class="crono-icon">${e.icono}</span><div><strong>${e.tipo}</strong><br><small>${e.descripcion}</small></div></div></li>`;
    });
}

window.compartirPartido = function() {
    const id = sessionStorage.getItem('equipoActivoId'); if(!id) return;
    const shareUrl = `${window.location.href.split('index.html')[0]}live.html?id=${id}`;
    document.getElementById('share-url-input').value = shareUrl;
    document.getElementById('modal-compartir').classList.add('active');
};

window.copyShareUrl = function() {
    const input = document.getElementById('share-url-input'); input.select(); document.execCommand('copy'); alert("Copiado.");
};

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

    const tSt = document.getElementById('pdf-tbody-staff'); tSt.innerHTML = '';
    partidoData.staff.filter(s => staffPresentesIds.includes(s.dbId)).forEach(s => {
        const tr = document.createElement('tr'); tr.className = "pdf-row";
        tr.innerHTML = `<td style="padding:8px;text-align:center;">👤</td><td style="padding:8px;">${s.alias}</td><td style="padding:8px;text-align:right;">${nombresRolesStaff[s.posicion]||'Staff'}</td>`;
        tSt.appendChild(tr);
    });

    const sectionCambios = document.getElementById('pdf-section-cambios');
    const tCambios = document.getElementById('pdf-tbody-cambios'); tCambios.innerHTML = '';
    const cambios = partidoData.cronologia.filter(c => c.meta && c.meta.tipo === 'cambio');
    if (cambios.length > 0) {
        sectionCambios.style.display = 'block';
        cambios.forEach(c => {
            const jEntra = partidoData.plantilla.find(j => j.id === c.meta.entraId) || { alias: '?' };
            const jSale = partidoData.plantilla.find(j => j.id === c.meta.saleId) || { alias: '?' };
            const tr = document.createElement('tr'); tr.className = "pdf-row";
            tr.innerHTML = `<td style="padding:8px;text-align:center;">${c.minuto}</td><td style="padding:8px;color:#2ECC71;">↑ ${jEntra.alias}</td><td style="padding:8px;color:#D12229;">↓ ${jSale.alias}</td>`;
            tCambios.appendChild(tr);
        });
    }

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Reporte_ATM_vs_${rival}.pdf`,
        pagebreak: { mode: ['css', 'avoid-all'], avoid: ['.pdf-row', 'h2', 'tr'] },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 790, onclone: (cloned) => { cloned.getElementById('pdf-wrapper').style.visibility = 'visible'; } },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
};

window.capturarAlineacion = function() {
    const crono = document.getElementById('crono-on-pitch');
    const subs = document.getElementById('dock-suplentes');
    const staff = document.getElementById('dock-staff');
    const iosDock = document.getElementById('ios-dock');
    crono.style.display = 'none'; subs.style.display = 'none'; staff.style.display = 'none'; if(iosDock) iosDock.style.display = 'none';
    cerrarRadial(); 
    html2canvas(document.querySelector('.main-board'), { backgroundColor: '#0F172A', scale: 2, useCORS: true }).then(canvas => {
        crono.style.display = 'flex'; subs.style.display = 'flex'; staff.style.display = 'flex'; if(iosDock) iosDock.style.display = 'flex';
        const imgData = canvas.toDataURL('image/png');
        document.getElementById('captura-preview').src = imgData;
        document.getElementById('btn-descargar-captura').href = imgData;
        document.getElementById('modal-captura').classList.add('active');
    });
};