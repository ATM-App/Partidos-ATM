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

            if (partidoData.estado === 'finalizado') {
                localStorage.removeItem('atletiProMatchState_' + equipoId);
            }
        }
    });
}

setInterval(() => {
    if (partidoData && partidoData.plantilla && partidoData.plantilla.length > 0 && partidoData.estado !== 'finalizado') {
        guardarEstadoNube();
    }
}, 3000);

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
        e.returnValue = 'Tienes un partido en curso. ¿Seguro que quieres salir?';
    }
});

function restaurarBotonesEstado() {
    document.querySelectorAll('.dock-btn, .ios-dock-btn').forEach(b => b.classList.remove('active'));
    
    if (partidoData.estado === 'primera_parte') {
        document.getElementById('btn-estado-partido').classList.add('active');
    } else if (partidoData.estado === 'descanso') {
        const desc = document.querySelector('.ios-dock-btn[onclick*="descanso"]'); if(desc) desc.classList.add('active');
    } else if (partidoData.estado === 'segunda_parte') {
        const seg = document.querySelector('.ios-dock-btn[onclick*="segunda_parte"]'); if(seg) seg.classList.add('active');
    } else if (partidoData.estado === 'finalizado') {
        const fin = document.querySelector('.ios-dock-btn[onclick*="finalizado"]'); if(fin) fin.classList.add('active');
    }
    
    const btnIniciar = document.getElementById('btn-estado-partido');
    if (partidoData.estado === 'previo') {
        if(titularesSeleccionados.length === LIMITE_TITULARES) {
            btnIniciar.style.opacity = '1'; btnIniciar.dataset.tooltip = "Iniciar Partido";
        } else {
            btnIniciar.style.opacity = '0.4'; btnIniciar.dataset.tooltip = `Faltan Jugadores`;
        }
    } else {
        btnIniciar.style.opacity = '1';
    }

    const btnTit = document.getElementById('btn-titulares');
    const btnDesc = document.getElementById('btn-desconvocados');
    const btnStaff = document.getElementById('btn-staff');
    
    if (partidoData.estado !== 'previo') {
        if(btnTit) btnTit.classList.add('locked');
        if(btnDesc) btnDesc.classList.add('locked');
        if(btnStaff) btnStaff.classList.add('locked');
    } else {
        if(btnTit) btnTit.classList.remove('locked');
        if(btnDesc) btnDesc.classList.remove('locked');
        if(btnStaff) btnStaff.classList.remove('locked');
    }
}

window.toggleTema = function() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('temaAtleti', isLight ? 'light' : 'dark');
};

window.salirApp = function() {
    if (partidoData.estado === 'primera_parte' || partidoData.estado === 'segunda_parte' || partidoData.estado === 'descanso') {
        if(!confirm("Hay un partido en curso. ¿Seguro que quieres salir de la sesión?")) return;
    }
    sessionStorage.removeItem('equipoActivoId');
    window.location.href = 'login.html';
};

window.toggleDockLabels = function() {
    document.getElementById('sidebar').classList.toggle('show-labels');
};

window.toggleCondicion = function() {
    const btn = document.getElementById('btn-condicion');
    if(btn.innerText.includes('Local')) {
        btn.innerText = '✈️ Visitante';
        btn.dataset.val = 'visitante';
    } else {
        btn.innerText = '🏠 Local';
        btn.dataset.val = 'local';
    }
    guardarEstadoNube();
};

window.selectPill = function(inputId, btnEl, value) {
    const group = btnEl.closest('.pill-group');
    group.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    document.getElementById(inputId).value = value;
};

window.abrirModalStaff = function() {
    if (partidoData.estado !== 'previo') return alert("No puedes modificar el cuerpo técnico una vez iniciado el partido.");
    document.getElementById('modal-staff').classList.add('active');
    renderizarSeleccionStaff();
};

function renderizarSeleccionStaff() {
    const cont = document.getElementById('lista-seleccion-staff'); 
    cont.innerHTML = '';
    
    if (partidoData.staff.length === 0) {
        cont.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">No tienes Cuerpo Técnico registrado en este equipo. Añádelos desde el Panel de Administración (Dejando el dorsal vacío).</span>';
        return;
    }

    partidoData.staff.forEach(s => {
        const estaPresente = staffPresentesIds.includes(s.dbId);
        const div = document.createElement('div');
        div.className = `list-item-dense ${estaPresente ? 'selected' : ''}`;
        
        const nombreRol = nombresRolesStaff[s.posicion] || s.posicion;
        
        div.innerHTML = `
            <div>
                <strong>${s.alias}</strong> 
                <br><small style="color:var(--text-muted);">${nombreRol}</small>
            </div>
            <div>${estaPresente ? '<i class="fa-solid fa-check" style="color:var(--atm-red);"></i>' : '⚪'}</div>
        `;
        
        div.onclick = () => {
            if(estaPresente) staffPresentesIds = staffPresentesIds.filter(id => id !== s.dbId);
            else staffPresentesIds.push(s.dbId);
            
            renderizarSeleccionStaff();
            renderizarStaffDock();
            guardarEstadoNube();
        };
        cont.appendChild(div);
    });
}

function renderizarStaffDock() {
    const cont = document.getElementById('dock-staff'); 
    cont.innerHTML = '';
    
    const presentes = partidoData.staff.filter(s => staffPresentesIds.includes(s.dbId));
    
    if(presentes.length === 0) { cont.style.display = 'none'; return; }
    cont.style.display = 'flex';

    presentes.forEach(s => {
        const div = document.createElement('div'); div.className = 'sub-miniature';
        
        let fotoStyle = '';
        let fotoClass = '';
        let contenidoCirculo = iconosStaff[s.posicion] || '<i class="fa-solid fa-user"></i>';

        if (s.foto && s.foto !== "") {
            fotoStyle = `background-image: url('${s.foto}');`;
            fotoClass = 'has-photo';
            contenidoCirculo = ''; 
        } 

        div.innerHTML = `
            <div class="sub-shirt staff-icon-circle ${fotoClass}" style="${fotoStyle}">${contenidoCirculo}</div>
            <span class="sub-name">${s.alias}</span>
            <span class="sub-time">${nombresRolesStaff[s.posicion] || 'Staff'}</span>
        `;
        cont.appendChild(div);
    });
}

window.abrirModalFormaciones = function() {
    cerrarRadial();
    if(partidoData.modalidad === 'f7') {
        document.getElementById('formaciones-f7').style.display = 'block';
        document.getElementById('formaciones-f11').style.display = 'none';
    } else {
        document.getElementById('formaciones-f11').style.display = 'block';
        document.getElementById('formaciones-f7').style.display = 'none';
    }
    document.getElementById('modal-formaciones').classList.add('active');
};

window.aplicarFormacion = function(tipo) {
    const enCampo = partidoData.plantilla.filter(j => j.enCampo && !desconvocadosIds.includes(j.id));
    if (enCampo.length === 0) return alert("Selecciona a los titulares antes de aplicar una formación.");

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

    enCampo.forEach((j, index) => {
        if (pos[index]) {
            j.posX = pos[index].left;
            j.posY = pos[index].top;
        }
    });

    animandoFormacion = true; 
    renderizarJugadores();
    cerrarModal();
    
    setTimeout(() => { 
        animandoFormacion = false; 
        renderizarJugadores(); 
        guardarEstadoNube(); 
    }, 600);
}

window.registrarLesion = function() {
    const j = partidoData.plantilla.find(p => p.id === jugadorSeleccionadoId);
    j.lesionado = true; 
    registrarEnCronologia("Lesión", `Atención médica: ${j.alias}`, '🚑');
    proximocambioPorLesion = true; 
    cerrarRadial();
    setTimeout(() => { mostrarBanquillo(); }, 400); 
};

window.abrirAmarillaRival = function() {
    if (partidoData.estado === 'previo') return alert("⚠️ Inicia el partido para registrar acciones.");
    cerrarRadial();
    document.getElementById('num-rival-amarilla').value = '';
    document.getElementById('modal-amarilla-rival').classList.add('active');
};

window.confirmarAmarillaRival = function() {
    const num = document.getElementById('num-rival-amarilla').value;
    if(!num) return alert("Indica el dorsal del jugador rival.");
    registrarEnCronologia("Amarilla Rival", `Jugador Rival #${num}`, '🟨🔸');
    cerrarModal();
};

function formatearTiempoSec(seg) {
    if (!seg) return "00:00";
    const m = Math.floor(seg / 60).toString().padStart(2, '0');
    const s = (seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

window.abrirModalAlineacion = function() {
    if (partidoData.estado !== 'previo') return alert("No puedes modificar los titulares una vez iniciado el partido.");
    document.getElementById('desconvocados-modal').classList.remove('active');
    document.getElementById('titulares-limit').innerText = LIMITE_TITULARES;
    document.getElementById('lineup-modal').classList.add('active');
    renderizarListaSeleccionTitulares();
};

window.abrirPanelDesconvocados = function() {
    if (partidoData.estado !== 'previo') return alert("No puedes modificar las bajas una vez iniciado el partido.");
    document.getElementById('lineup-modal').classList.remove('active');
    document.getElementById('desconvocados-modal').classList.add('active');
    const cont = document.getElementById('lista-desconvocados'); cont.innerHTML = '';
    
    partidoData.plantilla.forEach(j => {
        const esDesc = desconvocadosIds.includes(j.id);
        const div = document.createElement('div');
        div.className = `list-item-dense ${esDesc ? 'selected' : ''}`;
        
        let fotoStyle = ''; let fotoClass = ''; let shirtClass = '';
        if (j.foto && j.foto !== "") {
            fotoStyle = `background-image: url('${j.foto}');`;
            fotoClass = 'has-photo';
        } else {
            if (j.posicion === 'portero') shirtClass = 'bg-portero-black'; 
            else shirtClass = 'shirt-pattern-atm'; 
        }
        let miniAvatar = `<div class="sub-shirt ${shirtClass} ${fotoClass}" style="${fotoStyle} margin-right:12px; width:30px; height:30px; font-size:0.75rem;">${j.id}</div>`;

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${miniAvatar} 
                <div>
                    <strong>${j.id}</strong> - ${j.alias} 
                    <br><small style="color:var(--text-muted); text-transform:uppercase; font-size:0.65rem;">${j.posicion}</small>
                </div>
            </div>
            <div>${esDesc ? '<i class="fa-solid fa-ban" style="color:var(--atm-red);"></i>' : '⚪'}</div>
        `;
        
        div.onclick = () => {
            if(esDesc) desconvocadosIds = desconvocadosIds.filter(id => id !== j.id);
            else { desconvocadosIds.push(j.id); titularesSeleccionados = titularesSeleccionados.filter(id => id !== j.id); j.enCampo = false; }
            abrirPanelDesconvocados(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
        };
        cont.appendChild(div);
    });
};

window.cerrarModalDesconvocados = () => {
    document.getElementById('desconvocados-modal').classList.remove('active');
    abrirModalAlineacion();
};

function renderizarListaSeleccionTitulares() {
    const contenedor = document.getElementById('lista-seleccion-titulares'); contenedor.innerHTML = '';
    document.getElementById('titulares-count').innerText = titularesSeleccionados.length;
    
    const btn = document.getElementById('btn-confirmar-alineacion');
    btn.disabled = titularesSeleccionados.length !== LIMITE_TITULARES;
    btn.onclick = confirmarAlineacionInicial; 

    const btnIniciar = document.getElementById('btn-estado-partido');
    if (btnIniciar) {
        if(titularesSeleccionados.length === LIMITE_TITULARES) {
            btnIniciar.style.opacity = '1'; btnIniciar.dataset.tooltip = "Iniciar Partido";
        } else {
            btnIniciar.style.opacity = '0.4'; btnIniciar.dataset.tooltip = `Faltan Jugadores`;
        }
    }

    partidoData.plantilla.forEach(j => {
        if(desconvocadosIds.includes(j.id)) return; 
        const sel = titularesSeleccionados.includes(j.id);
        const div = document.createElement('div');
        div.className = `list-item-dense ${sel ? 'selected' : ''}`;
        
        let fotoStyle = ''; let fotoClass = ''; let shirtClass = '';
        if (j.foto && j.foto !== "") {
            fotoStyle = `background-image: url('${j.foto}');`;
            fotoClass = 'has-photo';
        } else {
            if (j.posicion === 'portero') shirtClass = 'bg-portero-black'; 
            else shirtClass = 'shirt-pattern-atm'; 
        }
        let miniAvatar = `<div class="sub-shirt ${shirtClass} ${fotoClass}" style="${fotoStyle} margin-right:12px; width:30px; height:30px; font-size:0.75rem;">${j.id}</div>`;

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${miniAvatar} 
                <div>
                    <strong>${j.id}</strong> - ${j.alias} 
                    <br><small style="color:var(--text-muted); text-transform:uppercase; font-size:0.65rem;">${j.posicion}</small>
                </div>
            </div>
            <div>${sel ? '<i class="fa-solid fa-check" style="color:var(--atm-red);"></i>' : '⚪'}</div>
        `;

        div.onclick = () => {
            if (sel) titularesSeleccionados = titularesSeleccionados.filter(id => id !== j.id);
            else if (titularesSeleccionados.length < LIMITE_TITULARES) titularesSeleccionados.push(j.id);
            renderizarListaSeleccionTitulares();
        };
        contenedor.appendChild(div);
    });
}

function confirmarAlineacionInicial() {
    partidoData.plantilla.forEach(j => { j.enCampo = titularesSeleccionados.includes(j.id); });
    document.getElementById('lineup-modal').classList.remove('active');
    renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
}

function renderizarJugadores() {
    const campo = document.getElementById('contenedor-campo'); campo.innerHTML = '';
    
    let posDefault = [
        {top: '50%', left: '8%'}, {top: '20%', left: '25%'}, {top: '80%', left: '25%'}, {top: '40%', left: '22%'},
        {top: '60%', left: '22%'}, {top: '30%', left: '50%'}, {top: '70%', left: '50%'}, {top: '50%', left: '45%'},
        {top: '25%', left: '75%'}, {top: '75%', left: '75%'}, {top: '50%', left: '80%'}
    ];
    let i = 0;
    
    partidoData.plantilla.forEach(j => {
        if (j.enCampo && !desconvocadosIds.includes(j.id)) {
            const p = posDefault[i] || {top:'50%', left:'50%'};
            const node = document.createElement('div');
            node.className = 'player-node'; 
            
            if (animandoFormacion) node.classList.add('animating-pos');

            node.style.top = j.posY || p.top; 
            node.style.left = j.posX || p.left;
            
            let iconosHTML = '';
            if(j.stats.goles > 0) {
                iconosHTML += `<div class="action-icon-pitch" style="font-size:1.3rem;">⚽`; 
                if(j.stats.goles > 1) iconosHTML += `<span class="multiplier">x${j.stats.goles}</span>`;
                iconosHTML += `</div>`;
            }
            if(j.stats.amarillas > 0) iconosHTML += `<div class="action-icon-pitch" style="color:#F1C40F;"><i class="fa-solid fa-square"></i></div>`;
            if(j.stats.rojas > 0) iconosHTML += `<div class="action-icon-pitch" style="color:var(--atm-red);"><i class="fa-solid fa-square"></i></div>`;

            let fotoStyle = '';
            let fotoClass = '';
            let shirtClass = '';

            if (j.foto && j.foto !== "") {
                fotoStyle = `background-image: url('${j.foto}');`;
                fotoClass = 'has-photo';
            } else {
                if (j.posicion === 'portero') {
                    shirtClass = 'bg-portero-black'; 
                } else {
                    shirtClass = 'shirt-pattern-atm'; 
                }
            }

            const tiempoVisual = formatearTiempoSec(j.minutosJugados);

            node.innerHTML = `<div class="player-circle ${shirtClass} ${fotoClass}" style="${fotoStyle}">${j.id}</div><span class="player-name">${j.alias}</span><span class="player-time" id="time-${j.id}">${tiempoVisual}</span><div class="indicators">${iconosHTML}</div>`;
            
            habilitarDrag(node, j);
            campo.appendChild(node); i++;
        }
    });
}

function habilitarDrag(el, j) {
    let isDragging = false; 
    let moved = false;
    let startX, startY, initialX, initialY;

    const onMove = e => {
        if (!isDragging) return;
        const x = e.clientX || (e.touches && e.touches[0].clientX);
        const y = e.clientY || (e.touches && e.touches[0].clientY);
        if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) moved = true;
        
        if (moved) e.preventDefault(); 
        
        const cont = document.getElementById('contenedor-campo-padre').getBoundingClientRect();
        el.style.left = `${((initialX + (x - startX)) / cont.width) * 100}%`;
        el.style.top = `${((initialY + (y - startY)) / cont.height) * 100}%`;
    };

    const onUp = e => {
        if (!isDragging) return;
        isDragging = false; 
        el.style.zIndex = '';
        
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        
        if (partidoData.estado === 'previo') {
            const pitch = document.getElementById('contenedor-campo-padre');
            const pitchRect = pitch.getBoundingClientRect();
            const x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const y = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            
            if (x < pitchRect.left || x > pitchRect.right || y < pitchRect.top || y > pitchRect.bottom) {
                j.enCampo = false;
                j.posX = null;
                j.posY = null;
                titularesSeleccionados = titularesSeleccionados.filter(id => id !== j.id);
                renderizarJugadores();
                renderizarSuplentesDock();
                restaurarBotonesEstado();
                guardarEstadoNube();
                return; 
            }
        }
        
        j.posX = el.style.left; 
        j.posY = el.style.top;
        guardarEstadoNube(); 
    };

    el.addEventListener('pointerdown', e => {
        el.classList.remove('animating-pos');
        
        isDragging = true; moved = false;
        startX = e.clientX || (e.touches && e.touches[0].clientX); 
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        initialX = el.offsetLeft; 
        initialY = el.offsetTop;
        el.style.zIndex = 100;
        
        document.addEventListener('pointermove', onMove, {passive: false});
        document.addEventListener('pointerup', onUp);
    });

    el.addEventListener('click', e => {
        if(moved) { e.preventDefault(); return; }
        abrirRadialMenu(j.id, el);
    });
}

function renderizarSuplentesDock() {
    const cont = document.getElementById('dock-suplentes'); cont.innerHTML = '';
    const suplentes = partidoData.plantilla.filter(j => !j.enCampo && !desconvocadosIds.includes(j.id));
    
    if(suplentes.length === 0) { cont.style.display = 'none'; return; }
    cont.style.display = 'flex';

    suplentes.forEach(j => {
        const div = document.createElement('div'); div.className = 'sub-miniature';
        
        let fotoStyle = '';
        let fotoClass = '';
        let shirtClass = '';

        if (j.foto && j.foto !== "") {
            fotoStyle = `background-image: url('${j.foto}');`;
            fotoClass = 'has-photo';
        } else {
            if (j.posicion === 'portero') {
                shirtClass = 'bg-portero-black'; 
            } else {
                shirtClass = 'shirt-pattern-atm'; 
            }
        }

        let iconosEstado = '';
        if (j.stats.rojas > 0) iconosEstado += '<i class="fa-solid fa-square" style="color:var(--atm-red); margin-left:4px; font-size:0.7rem;"></i>';
        if (j.lesionado) iconosEstado += '<i class="fa-solid fa-kit-medical" style="color:#eb4d4b; margin-left:4px; font-size:0.7rem;"></i>';

        div.innerHTML = `
            <div class="sub-shirt ${shirtClass} ${fotoClass}" style="${fotoStyle}">${j.id}</div>
            <span class="sub-name" style="display:flex; align-items:center;">${j.alias} ${iconosEstado}</span>
            <span class="sub-time" id="sub-time-${j.id}">(${formatearTiempoSec(j.minutosJugados)})</span>
        `;
        
        habilitarDragBanquillo(div, j);
        cont.appendChild(div);
    });
}

function habilitarDragBanquillo(el, j) {
    let isDragging = false;
    let moved = false;
    let ghost = null;
    let startX, startY;

    el.style.touchAction = 'none'; 

    const onMove = e => {
        if (!isDragging || !ghost) return;
        const x = e.clientX || (e.touches && e.touches[0].clientX);
        const y = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!moved && (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5)) {
            moved = true;
        }
        
        if (moved) {
            e.preventDefault(); 
            ghost.style.left = (x - ghost.offsetWidth / 2) + 'px';
            ghost.style.top = (y - ghost.offsetHeight / 2) + 'px';
        }
    };

    const onUp = e => {
        if (!isDragging) return;
        isDragging = false;
        
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        
        if (ghost) {
            ghost.remove();
            ghost = null;
        }

        if (moved && partidoData.estado === 'previo') {
            const x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const y = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            
            const pitch = document.getElementById('contenedor-campo-padre');
            const pitchRect = pitch.getBoundingClientRect();

            if (x >= pitchRect.left && x <= pitchRect.right && y >= pitchRect.top && y <= pitchRect.bottom) {
                
                if (j.stats.rojas > 0) {
                    alert(`❌ El jugador ${j.alias} fue expulsado y no puede volver a ingresar.`);
                    return;
                }
                if (j.lesionado) {
                    alert(`🚑 El jugador ${j.alias} está lesionado y no puede volver a ingresar.`);
                    return;
                }

                if (titularesSeleccionados.length < LIMITE_TITULARES) {
                    j.enCampo = true;
                    titularesSeleccionados.push(j.id);
                    
                    let leftPct = ((x - pitchRect.left) / pitchRect.width) * 100;
                    let topPct = ((y - pitchRect.top) / pitchRect.height) * 100;
                    j.posX = leftPct + '%';
                    j.posY = topPct + '%';
                    
                    renderizarJugadores();
                    renderizarSuplentesDock();
                    restaurarBotonesEstado();
                    guardarEstadoNube();
                } else {
                    alert(`Límite de titulares alcanzado (${LIMITE_TITULARES}). No puedes meter más jugadores.`);
                }
            }
        }
        moved = false;
    };

    el.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        if (partidoData.estado !== 'previo') return; 
        
        isDragging = true;
        moved = false;
        startX = e.clientX || (e.touches && e.touches[0].clientX);
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (ghost) { ghost.remove(); }
        
        ghost = el.cloneNode(true);
        ghost.style.position = 'fixed';
        ghost.style.zIndex = 9999;
        ghost.style.opacity = '0.9';
        ghost.style.pointerEvents = 'none'; 
        ghost.style.transform = 'scale(1.2)'; 
        ghost.style.margin = '0';
        
        const rect = el.getBoundingClientRect();
        ghost.style.left = rect.left + 'px';
        ghost.style.top = rect.top + 'px';
        
        document.body.appendChild(ghost);
        
        document.addEventListener('pointermove', onMove, {passive: false});
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp); 
    });

    el.addEventListener('click', e => {
        if (moved) {
            e.preventDefault();
            return;
        }
        if(document.getElementById('radial-overlay').classList.contains('active') && jugadorSeleccionadoId) {
            if (j.stats.rojas > 0) return alert(`❌ El jugador ${j.alias} fue expulsado y no puede ingresar.`);
            if (j.lesionado) return alert(`🚑 El jugador ${j.alias} está lesionado y no puede ingresar.`);
            ejecutarCambio(jugadorSeleccionadoId, j.id);
        } else if (partidoData.estado !== 'previo') {
            alert("Para sustituir: Toca primero al titular en el campo y luego a este suplente, o usa el menú de Cambio.");
        }
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
            const dom = document.getElementById(`time-${j.id}`);
            if(dom) dom.innerText = formatearTiempoSec(segInd);
        }
    });
    requestAnimationFrame(actualizarRelojGlobal);
}

window.cambiarEstadoPartido = function(nuevoEstado) {
    const statusDom = document.getElementById('global-status');
    const ahora = Date.now();
    
    if (nuevoEstado === 'primera_parte' && partidoData.estado === 'previo') {
        const enCampo = partidoData.plantilla.filter(j => j.enCampo).length;
        if(enCampo !== LIMITE_TITULARES) return alert(`Alineación incompleta. Tienes ${enCampo} jugadores en campo.`);
        
        partidoData.estado = 'primera_parte'; partidoData.inicioPeriodoTimestamp = ahora;
        partidoData.plantilla.forEach(j => { if(j.enCampo) j.tiempoEntrada = ahora; });
        statusDom.innerText = '1ª PARTE'; 
        restaurarBotonesEstado();
        registrarEnCronologia("Inicio", "Comienza 1º Tiempo", '<i class="fa-solid fa-play" style="color:var(--atm-red);"></i>', "0'", {tipo:'estado'});
        actualizarRelojGlobal();
        document.getElementById('crono-on-pitch').style.display = 'flex';
        guardarEstadoNube();
    } 
    else if(nuevoEstado === 'descanso' && partidoData.estado === 'primera_parte') {
        partidoData.estado = 'descanso'; 
        partidoData.segundosAcumuladosPrimera = Math.floor((ahora - partidoData.inicioPeriodoTimestamp) / 1000);
        partidoData.plantilla.forEach(j => { if(j.enCampo && j.tiempoEntrada){ j.minutosJugados += Math.floor((ahora-j.tiempoEntrada)/1000); j.tiempoEntrada = null;} });
        statusDom.innerText = 'DESCANSO'; 
        restaurarBotonesEstado();
        registrarEnCronologia("Descanso", "Fin 1º Tiempo", '<i class="fa-solid fa-pause" style="color:#F1C40F;"></i>', `${Math.floor(partidoData.segundosAcumuladosPrimera/60)}'`, {tipo:'estado'});
        renderizarSuplentesDock();
        guardarEstadoNube();
    }
    else if(nuevoEstado === 'segunda_parte' && partidoData.estado === 'descanso') {
        partidoData.estado = 'segunda_parte'; 
        partidoData.inicioPeriodoTimestamp = ahora; 
        partidoData.plantilla.forEach(j => { if(j.enCampo) j.tiempoEntrada = ahora; });
        statusDom.innerText = '2ª PARTE'; 
        restaurarBotonesEstado();
        registrarEnCronologia("Reinicio", "Comienza 2º Tiempo", '<i class="fa-solid fa-forward-step" style="color:var(--atm-red);"></i>', `${Math.floor(partidoData.segundosAcumuladosPrimera/60)}'`, {tipo:'estado'});
        actualizarRelojGlobal();
        guardarEstadoNube();
    }
    else if(nuevoEstado === 'finalizado') {
        partidoData.estado = 'finalizado';
        partidoData.plantilla.forEach(j => { if(j.enCampo && j.tiempoEntrada){ j.minutosJugados += Math.floor((ahora-j.tiempoEntrada)/1000); j.tiempoEntrada = null;} });
        statusDom.innerText = 'FINALIZADO'; 
        restaurarBotonesEstado();
        
        registrarEnCronologia("Final", "Partido Terminado", '<i class="fa-solid fa-stop" style="color:#3498DB;"></i>', "Fin", {tipo:'estado'});
        
        renderizarSuplentesDock();
        renderizarJugadores(); 
        
        const equipoId = sessionStorage.getItem('equipoActivoId');
        localStorage.removeItem('atletiProMatchState_' + equipoId);

        const payloadFinal = {
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
        db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').set(payloadFinal);

        setTimeout(() => { exportarPDF(); }, 500);

        setTimeout(() => {
            const jornada = document.getElementById('jornada-info').value;
            const rival = document.getElementById('rival-input').value || 'Sin Rival';
            const fecha = document.querySelector('input[type="date"]').value;
            const nombre = `Jornada ${jornada} - ${rival}`;

            const payloadGuardado = {
                nombre, jornada, rival, fecha,
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
                alert("✅ Partido Finalizado, guardado en la nube y reporte PDF generado.");
            }).catch(e => console.error("Error al autoguardar:", e));
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
    if (partidoData.estado === 'previo') {
        alert("⚠️ Debes iniciar el partido para poder registrar acciones (Goles, Tarjetas, Cambios).");
        return;
    }
    jugadorSeleccionadoId = id;
    const menu = document.getElementById('radial-menu');
    const rect = elDOM.getBoundingClientRect();
    
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left + rect.width / 2}px`;
    menu.style.top = `${rect.top + rect.height / 2}px`;
    
    document.getElementById('radial-overlay').classList.add('active');
};

window.cerrarRadial = () => document.getElementById('radial-overlay').classList.remove('active');
window.cerrarModal = () => { document.querySelectorAll('.overlay').forEach(m => m.classList.remove('active')); modoEdicionEventoIndex = null;};

window.mostrarBanquillo = function() {
    cerrarRadial();
    const sale = partidoData.plantilla.find(j => j.id === jugadorSeleccionadoId);
    document.getElementById('texto-jugador-sale').innerText = sale.alias;
    const cont = document.getElementById('lista-banquillo-cambio'); cont.innerHTML = '';
    
    const suplentes = partidoData.plantilla.filter(j => !j.enCampo && !desconvocadosIds.includes(j.id));
    suplentes.forEach(j => {
        const btn = document.createElement('div'); btn.className = 'list-item-dense';
        
        let fotoStyle = ''; let fotoClass = ''; let shirtClass = '';
        if (j.foto && j.foto !== "") { fotoStyle = `background-image: url('${j.foto}');`; fotoClass = 'has-photo'; } 
        else { if (j.posicion === 'portero') shirtClass = 'bg-portero-black'; else shirtClass = 'shirt-pattern-atm'; }
        let miniAvatar = `<div class="sub-shirt ${shirtClass} ${fotoClass}" style="${fotoStyle} margin-right:12px; width:30px; height:30px; font-size:0.75rem;">${j.id}</div>`;

        let iconosEstado = '';
        if (j.stats.rojas > 0) iconosEstado += '<i class="fa-solid fa-square" style="color:var(--atm-red); margin-left:6px;"></i>';
        if (j.lesionado) iconosEstado += '<i class="fa-solid fa-kit-medical" style="color:#eb4d4b; margin-left:6px;"></i>';

        btn.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${miniAvatar}
                <div><strong>${j.id}</strong> - ${j.alias} ${iconosEstado} <br><span style="font-size:0.65rem; color:var(--text-muted);">(${formatearTiempoSec(j.minutosJugados)})</span></div>
            </div>
            <i class="fa-solid fa-arrow-up" style="color:#3498DB;"></i>`;
        
        btn.onclick = () => {
            if (j.stats.rojas > 0) return alert(`❌ El jugador ${j.alias} fue expulsado y no puede ingresar.`);
            if (j.lesionado) return alert(`🚑 El jugador ${j.alias} está lesionado y no puede ingresar.`);
            ejecutarCambio(jugadorSeleccionadoId, j.id);
        };
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
    
    const icono = proximocambioPorLesion ? '<span style="font-size:1.1rem;">🔄🚑</span>' : '<i class="fa-solid fa-rotate" style="color:#3498DB;"></i>';
    const desc = proximocambioPorLesion ? `Cambio por lesión: ${jEntra.alias} por ${jSale.alias}` : `Entra ${jEntra.alias} por ${jSale.alias}`;
    
    registrarEnCronologia(`Cambio`, desc, icono, null, {tipo:'cambio', saleId: idSale, entraId: idEntra});
    
    proximocambioPorLesion = false; 
    cerrarModal(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
}

window.modificarGoles = (equipo, num) => { 
    if (partidoData.estado === 'previo') {
        alert("⚠️ Debes iniciar el partido para poder modificar el marcador.");
        return;
    }
    const dom = document.getElementById(`score-${equipo}`); 
    const nuevo = Math.max(0, parseInt(dom.innerText) + num);
    dom.innerText = nuevo; 
    guardarEstadoNube();
};

window.prepararGolRival = function() {
    if (partidoData.estado === 'previo') {
        alert("⚠️ Debes iniciar el partido para poder registrar acciones.");
        return;
    }
    document.getElementById('rival-tipo-gol').value = 'Jugada colectiva';
    document.querySelectorAll('#grupo-tipo-gol-rival .pill-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#grupo-tipo-gol-rival .pill-btn').classList.add('active');
    
    document.getElementById('rival-gol-nombre').value = '';
    document.getElementById('rival-asis-nombre').value = '';
    document.getElementById('modal-gol-rival').classList.add('active');
};

window.confirmarGolRival = function() {
    const nom = document.getElementById('rival-gol-nombre').value || 'Jugador Rival';
    const tipo = document.getElementById('rival-tipo-gol').value;
    const asis = document.getElementById('rival-asis-nombre').value;
    const txtAsis = asis ? ` (Asist: ${asis})` : '';
    
    if(modoEdicionEventoIndex !== null) {
        let ev = partidoData.cronologia[modoEdicionEventoIndex];
        ev.tipo = `Gol Rival (${nom})`; ev.descripcion = `${tipo}${txtAsis}`;
        ev.meta = {tipo:'gol_rival', jugador: nom, tipoGol: tipo, asistencia: asis};
        modoEdicionEventoIndex = null;
        cerrarModal(); renderizarCronologia(); guardarEstadoNube();
    } else {
        registrarEnCronologia(`Gol Rival (${nom})`, `${tipo}${txtAsis}`, '⚽', null, {tipo:'gol_rival', jugador: nom, tipoGol: tipo, asistencia: asis});
        window.modificarGoles('rival', 1);
        cerrarModal(); 
    }
};

window.prepararGol = function() {
    cerrarRadial();
    document.getElementById('tipo-gol').value = 'Jugada colectiva';
    document.querySelectorAll('#grupo-tipo-gol-atm .pill-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#grupo-tipo-gol-atm .pill-btn').classList.add('active');

    const selAsis = document.getElementById('asistencia-list'); 
    selAsis.innerHTML = `<button type="button" class="pill-btn active" onclick="selectPill('asistencia-gol', this, '')">Sin asistencia</button>`;
    document.getElementById('asistencia-gol').value = '';

    partidoData.plantilla.filter(j => j.enCampo && j.id !== jugadorSeleccionadoId).forEach(j => {
        selAsis.innerHTML += `<button type="button" class="pill-btn" onclick="selectPill('asistencia-gol', this, '${j.alias}')">${j.alias}</button>`;
    });

    document.getElementById('modal-opciones-gol').classList.add('active');
};

window.confirmarGol = function() {
    const tipo = document.getElementById('tipo-gol').value;
    const asis = document.getElementById('asistencia-gol').value;
    const txtAsis = asis ? ` (Asist: ${asis})` : '';

    if (modoEdicionEventoIndex !== null) {
        let ev = partidoData.cronologia[modoEdicionEventoIndex];
        let oldAsis = ev.meta.asistencia;
        
        if (oldAsis && oldAsis !== asis) {
            const jOld = partidoData.plantilla.find(p => p.alias === oldAsis);
            if (jOld && jOld.stats.asistencias > 0) jOld.stats.asistencias--;
        }
        
        if (asis && oldAsis !== asis) {
            const jNew = partidoData.plantilla.find(p => p.alias === asis);
            if (jNew) jNew.stats.asistencias = (jNew.stats.asistencias || 0) + 1;
        }

        ev.descripcion = `${tipo}${txtAsis}`;
        ev.meta = {tipo:'gol_atm', jugadorId: jugadorSeleccionadoId, tipoGol: tipo, asistencia: asis};
        modoEdicionEventoIndex = null;
        
        cerrarModal(); 
        renderizarJugadores(); 
        renderizarCronologia(); 
        guardarEstadoNube(); 
    } else {
        const j = partidoData.plantilla.find(j => j.id === jugadorSeleccionadoId);
        j.stats.goles = parseInt(j.stats.goles || 0) + 1;
        
        if (asis) {
            const jAsistencia = partidoData.plantilla.find(p => p.alias === asis);
            if (jAsistencia) {
                jAsistencia.stats.asistencias = parseInt(jAsistencia.stats.asistencias || 0) + 1;
            }
        }
        
        window.modificarGoles('atm', 1);
        registrarEnCronologia(`Gol de ${j.alias}`, `${tipo}${txtAsis}`, '⚽', null, {tipo:'gol_atm', jugadorId: j.id, tipoGol: tipo, asistencia: asis}); 
        cerrarModal(); renderizarJugadores();
    }
};

window.confirmarTarjeta = function(tipo) {
    const j = partidoData.plantilla.find(j => j.id === jugadorSeleccionadoId);
    if(tipo==='amarilla') j.stats.amarillas = parseInt(j.stats.amarillas || 0) + 1; 
    else j.stats.rojas = parseInt(j.stats.rojas || 0) + 1;
    
    const color = tipo === 'amarilla' ? '#F1C40F' : '#D12229';
    registrarEnCronologia(`T. ${tipo==='amarilla'?'Amarilla':'Roja'} para ${j.alias}`, `Falta`, `<i class="fa-solid fa-square" style="color:${color};"></i>`, null, {tipo:'tarjeta'}); 
    
    if(tipo === 'roja') { j.enCampo = false; }
    cerrarRadial(); renderizarJugadores(); renderizarSuplentesDock(); guardarEstadoNube();
};

function registrarEnCronologia(tipo, desc, icono="", minOpcional=null, metaObj={}) {
    const minFinal = minOpcional || obtenerMinutoGlobal();
    partidoData.cronologia.push({minuto: minFinal, tipo: tipo, descripcion: desc, icono: icono, meta: metaObj});
    renderizarCronologia();
    guardarEstadoNube();
}

function renderizarCronologia() {
    const list = document.getElementById('lista-cronologia'); list.innerHTML = '';
    const cronoPitch = document.getElementById('crono-on-pitch');
    
    if(partidoData.cronologia.length === 0) { cronoPitch.style.display = 'none'; return; }
    if(partidoData.estado !== 'previo') cronoPitch.style.display = 'flex';

    [...partidoData.cronologia].reverse().forEach((e, invIdx) => {
        const realIdx = partidoData.cronologia.length - 1 - invIdx;
        list.innerHTML += `<li class="crono-item">
            <div class="crono-left"><span class="crono-min">${e.minuto}</span><span class="crono-icon">${e.icono}</span><div><strong style="color:white; font-family:'Montserrat';">${e.tipo}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${e.descripcion}</span></div></div>
            <button class="btn-edit-crono" onclick="abrirModalEdicion(${realIdx})"><i class="fa-solid fa-pen"></i></button>
        </li>`;
    });
}

window.abrirModalEdicion = (idx) => {
    const ev = partidoData.cronologia[idx];
    document.getElementById('edit-index').value = idx;
    modoEdicionEventoIndex = idx;

    if(ev.meta && ev.meta.tipo === 'gol_atm') {
        jugadorSeleccionadoId = ev.meta.jugadorId;
        document.getElementById('tipo-gol').value = ev.meta.tipoGol;
        prepararGol(); 
    } 
    else if (ev.meta && ev.meta.tipo === 'gol_rival') {
        document.getElementById('rival-gol-nombre').value = ev.meta.jugador;
        document.getElementById('rival-tipo-gol').value = ev.meta.tipoGol;
        document.getElementById('rival-asis-nombre').value = ev.meta.asistencia;
        document.getElementById('modal-gol-rival').classList.add('active');
    }
    else {
        document.getElementById('edit-descripcion').value = ev.descripcion;
        document.getElementById('edit-modal').classList.add('active');
    }
};

window.guardarEdicionEvento = () => {
    partidoData.cronologia[document.getElementById('edit-index').value].descripcion = document.getElementById('edit-descripcion').value;
    renderizarCronologia(); cerrarModal(); guardarEstadoNube();
};

window.eliminarEvento = () => {
    if(confirm("¿Seguro que quieres eliminar este evento? (Si es gol, resta el marcador manualmente)")) { 
        partidoData.cronologia.splice(document.getElementById('edit-index').value, 1); 
        renderizarCronologia(); cerrarModal(); guardarEstadoNube();
    }
};

window.nuevoPartido = async function() {
    if(confirm("¿Seguro que deseas empezar un nuevo partido? Se perderán los datos actuales si no los has guardado.")) {
        const equipoId = sessionStorage.getItem('equipoActivoId');
        await db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').delete();
        location.reload();
    }
};

window.guardarSeguimiento = async function() {
    const equipoId = sessionStorage.getItem('equipoActivoId');
    const jornada = document.getElementById('jornada-info').value;
    const rival = document.getElementById('rival-input').value || 'Sin Rival';
    const fecha = document.querySelector('input[type="date"]').value;
    const nombre = `Jornada ${jornada} - ${rival}`;

    if(!confirm(`¿Deseas guardar el partido como: ${nombre}?`)) return;

    const payload = {
        nombre, jornada, rival, fecha,
        partidoData: JSON.stringify(partidoData),
        titulares: JSON.stringify(titularesSeleccionados),
        desconvocados: JSON.stringify(desconvocadosIds),
        staffPresentes: JSON.stringify(staffPresentesIds),
        scoreAtm: document.getElementById('score-atm').innerText,
        scoreRival: document.getElementById('score-rival').innerText,
        timestamp: Date.now()
    };

    try {
        await db.collection(`Equipos/${equipoId}/PartidosGuardados`).add(payload);
        alert("Seguimiento guardado correctamente.");
    } catch(e) {
        alert("Error al guardar: " + e.message);
    }
};

window.abrirCargarSeguimiento = async function() {
    const equipoId = sessionStorage.getItem('equipoActivoId');
    const list = document.getElementById('lista-cargar-seguimiento');
    list.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Buscando seguimientos...</span>';
    document.getElementById('modal-cargar-seguimiento').classList.add('active');

    const snap = await db.collection(`Equipos/${equipoId}/PartidosGuardados`).orderBy('timestamp', 'desc').get();
    list.innerHTML = '';
    
    if(snap.empty) {
        list.innerHTML = '<span style="color:var(--text-muted);">No hay seguimientos guardados.</span>';
        return;
    }

    snap.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `
            <div class="list-item-dense" onclick="cargarSeguimiento('${doc.id}')">
                <div><strong>${d.nombre}</strong> <br><small style="color:var(--text-muted);">${d.fecha || 'Sin fecha'} | ATM ${d.scoreAtm} - ${d.scoreRival} Rival</small></div>
                <div style="display:flex; gap:15px; align-items:center;">
                    <i class="fa-solid fa-download" style="color:#3498DB;"></i>
                    <i class="fa-solid fa-trash" style="color:var(--atm-red);" onclick="event.stopPropagation(); eliminarSeguimiento('${doc.id}')"></i>
                </div>
            </div>
        `;
    });
};

window.cargarSeguimiento = async function(docId) {
    if(!confirm("¿Cargar este seguimiento? Esto sustituirá los datos actuales del campo.")) return;
    const equipoId = sessionStorage.getItem('equipoActivoId');
    const doc = await db.collection(`Equipos/${equipoId}/PartidosGuardados`).doc(docId).get();
    if(!doc.exists) return;

    const d = doc.data();
    document.getElementById('jornada-info').value = d.jornada;
    document.getElementById('rival-input').value = d.rival;
    if(d.fecha) document.querySelector('input[type="date"]').value = d.fecha;
    document.getElementById('score-atm').innerText = d.scoreAtm;
    document.getElementById('score-rival').innerText = d.scoreRival;

    partidoData = JSON.parse(d.partidoData);
    
    partidoData.staff = partidoData.staff || [];
    partidoData.staff.sort((a, b) => (ordenStaff[a.posicion] || 99) - (ordenStaff[b.posicion] || 99));
    
    partidoData.plantilla.forEach(j => {
        if (!j.stats) j.stats = { goles: 0, amarillas: 0, rojas: 0, asistencias: 0 };
        j.stats.goles = parseInt(j.stats.goles || 0);
        j.stats.amarillas = parseInt(j.stats.amarillas || 0);
        j.stats.rojas = parseInt(j.stats.rojas || 0);
        j.stats.asistencias = parseInt(j.stats.asistencias || 0);
        j.lesionado = j.lesionado || false;
    });

    if(d.titulares) titularesSeleccionados = JSON.parse(d.titulares);
    if(d.desconvocados) desconvocadosIds = JSON.parse(d.desconvocados);
    if(d.staffPresentes) staffPresentesIds = JSON.parse(d.staffPresentes);
    
    cerrarModal();
    renderizarJugadores();
    renderizarSuplentesDock();
    renderizarStaffDock();
    renderizarCronologia();
    restaurarBotonesEstado();
    document.getElementById('global-status').innerText = partidoData.estado === 'previo' ? 'PREVIO' : partidoData.estado.toUpperCase().replace('_', ' ');
    guardarEstadoNube();
};

window.eliminarSeguimiento = async function(docId) {
    if(!confirm("¿Seguro que quieres eliminar este partido guardado? Esta acción no se puede deshacer.")) return;
    const equipoId = sessionStorage.getItem('equipoActivoId');
    try {
        await db.collection(`Equipos/${equipoId}/PartidosGuardados`).doc(docId).delete();
        abrirCargarSeguimiento(); 
    } catch(e) {
        alert("Error al eliminar: " + e.message);
    }
};

window.abrirProgramarPartido = function() {
    document.getElementById('prog-fecha').value = '';
    document.getElementById('prog-rival').value = '';
    document.getElementById('prog-jornada').value = '';
    document.getElementById('modal-programar-partido').classList.add('active');
};

window.guardarProgramado = async function() {
    const equipoId = sessionStorage.getItem('equipoActivoId');
    const fecha = document.getElementById('prog-fecha').value;
    const rival = document.getElementById('prog-rival').value;
    const jornada = document.getElementById('prog-jornada').value;

    if(!fecha || !rival) return alert("Rellena la fecha y el nombre del rival.");

    await db.collection(`Equipos/${equipoId}/PartidosProgramados`).add({
        fecha, rival, jornada, timestamp: Date.now()
    });
    alert("Partido programado guardado correctamente.");
    cerrarModal();
};

window.abrirCargarProgramado = async function() {
    const equipoId = sessionStorage.getItem('equipoActivoId');
    const list = document.getElementById('lista-cargar-programado');
    list.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Buscando programados...</span>';
    document.getElementById('modal-cargar-programado').classList.add('active');

    const snap = await db.collection(`Equipos/${equipoId}/PartidosProgramados`).orderBy('fecha', 'asc').get();
    list.innerHTML = '';
    
    if(snap.empty) {
        list.innerHTML = '<span style="color:var(--text-muted);">No hay partidos programados.</span>';
        return;
    }

    snap.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `
            <div class="list-item-dense" onclick="cargarProgramado('${d.fecha}', '${d.rival}', '${d.jornada}')">
                <div><strong>Jornada ${d.jornada} - ${d.rival}</strong> <br><small style="color:var(--text-muted);">${d.fecha}</small></div>
                <div style="display:flex; gap:15px; align-items:center;">
                    <i class="fa-solid fa-calendar-check" style="color:#3498DB;"></i>
                    <i class="fa-solid fa-trash" style="color:var(--atm-red);" onclick="event.stopPropagation(); eliminarProgramado('${doc.id}')"></i>
                </div>
            </div>
        `;
    });
};

window.cargarProgramado = function(fecha, rival, jornada) {
    document.querySelector('input[type="date"]').value = fecha;
    document.getElementById('rival-input').value = rival;
    document.getElementById('jornada-info').value = jornada;
    cerrarModal();
    guardarEstadoNube();
};

window.eliminarProgramado = async function(docId) {
    if(!confirm("¿Seguro que quieres eliminar este partido programado?")) return;
    const equipoId = sessionStorage.getItem('equipoActivoId');
    try {
        await db.collection(`Equipos/${equipoId}/PartidosProgramados`).doc(docId).delete();
        abrirCargarProgramado(); 
    } catch(e) {
        alert("Error al eliminar: " + e.message);
    }
};

window.capturarAlineacion = function() {
    const crono = document.getElementById('crono-on-pitch');
    const subs = document.getElementById('dock-suplentes');
    const staff = document.getElementById('dock-staff');
    const iosDock = document.getElementById('ios-dock');
    
    const cronoDisp = crono.style.display;
    const subsDisp = subs.style.display;
    const staffDisp = staff.style.display;
    const iosDockDisp = iosDock ? iosDock.style.display : '';
    
    crono.style.display = 'none';
    subs.style.display = 'none';
    staff.style.display = 'none';
    if(iosDock) iosDock.style.display = 'none';
    cerrarRadial(); 

    const elementoACapturar = document.querySelector('.main-board');
    const isLight = document.body.classList.contains('light-theme');

    html2canvas(elementoACapturar, {
        backgroundColor: isLight ? '#e2e8f0' : '#0F172A',
        scale: 2,
        useCORS: true,
        allowTaint: true
    }).then(canvas => {
        crono.style.display = cronoDisp;
        subs.style.display = subsDisp;
        staff.style.display = staffDisp;
        if(iosDock) iosDock.style.display = iosDockDisp;

        const imgData = canvas.toDataURL('image/png');
        document.getElementById('captura-preview').src = imgData;
        
        const rivalName = document.getElementById('rival-input').value || 'Rival';
        const fileName = `Alineacion_ATM_vs_${rivalName}.png`;
        
        const btnDescarga = document.getElementById('btn-descargar-captura');
        btnDescarga.download = fileName;
        btnDescarga.href = imgData; 
        
        btnDescarga.onclick = function() {
            const a = document.createElement('a');
            a.href = imgData;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        
        document.getElementById('modal-captura').classList.add('active');
    }).catch(err => {
        console.error("Error al capturar la imagen:", err);
        alert("Hubo un error al generar la imagen. Verifica los permisos de tu navegador.");
        crono.style.display = cronoDisp;
        subs.style.display = subsDisp;
        staff.style.display = staffDisp;
        if(iosDock) iosDock.style.display = iosDockDisp;
    });
};

// =========================================================
// CORRECCIÓN PDF: USO DE FLEXBOX DIVS EN VEZ DE TABLAS HTML
// =========================================================
window.exportarPDF = function() {
    const fecha = document.querySelector('input[type="date"]').value || 'Sin fecha';
    const rival = document.getElementById('rival-input').value || 'Rival';
    const estadio = document.getElementById('estadio-input').value || 'No especificado';
    const jornada = document.getElementById('jornada-info').value || '-';
    const categoria = document.getElementById('categoria-info').value || 'F11';
    const condicion = document.getElementById('btn-condicion').innerText;
    const scoreAtm = document.getElementById('score-atm').innerText;
    const scoreRival = document.getElementById('score-rival').innerText;
    const status = document.getElementById('global-status').innerText;

    document.getElementById('pdf-fecha').innerText = fecha;
    document.getElementById('pdf-rival-name').innerText = rival;
    document.getElementById('pdf-score-atm').innerText = scoreAtm;
    document.getElementById('pdf-score-rival').innerText = scoreRival;
    document.getElementById('pdf-match-status').innerText = status;
    document.getElementById('pdf-cat').innerText = categoria;
    document.getElementById('pdf-jor').innerText = jornada;
    document.getElementById('pdf-cam').innerText = estadio;
    document.getElementById('pdf-con').innerText = condicion;

    const ahora = Date.now();
    partidoData.plantilla.forEach(j => {
        j.minutosPdf = j.minutosJugados;
        if (j.enCampo && j.tiempoEntrada && (partidoData.estado === 'primera_parte' || partidoData.estado === 'segunda_parte')) {
            j.minutosPdf += Math.floor((ahora - j.tiempoEntrada) / 1000);
        }
    });

    const titulares = partidoData.plantilla.filter(j => titularesSeleccionados.includes(j.id) && !desconvocadosIds.includes(j.id));
    const suplentes = partidoData.plantilla.filter(j => !titularesSeleccionados.includes(j.id) && !desconvocadosIds.includes(j.id));
    const desconvocados = partidoData.plantilla.filter(j => desconvocadosIds.includes(j.id));
    
    let cuerpoTecnico = partidoData.staff.filter(s => staffPresentesIds.includes(s.dbId));
    cuerpoTecnico.sort((a, b) => (ordenStaff[a.posicion] || 99) - (ordenStaff[b.posicion] || 99));

    const renderRow = (j) => {
        const m = Math.floor(j.minutosPdf / 60).toString().padStart(2, '0');
        const s = (j.minutosPdf % 60).toString().padStart(2, '0');
        const minFormat = `${m}:${s}`;

        const row = document.createElement('div');
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.borderBottom = "1px solid #e2e8f0";
        row.className = "avoid-page-break"; 
        
        row.innerHTML = `
            <div style="padding: 10px; text-align: center; width: 60px; box-sizing: border-box;"><strong>${j.id}</strong></div>
            <div style="padding: 10px; text-align: left; flex: 1; box-sizing: border-box;">${j.alias} <span style="font-size:11px; color:#64748b; margin-left:5px;">${j.nombre || ''}</span></div>
            <div style="padding: 10px; text-align: center; width: 60px; text-transform: uppercase; font-size:12px; box-sizing: border-box;">${j.posicion.substring(0,3)}</div>
            <div style="padding: 10px; text-align: center; width: 80px; font-weight: bold; color: #1C2C5B; box-sizing: border-box;">${minFormat}</div>
            <div style="padding: 10px; text-align: center; width: 60px; box-sizing: border-box;">${j.stats.goles > 0 ? j.stats.goles : '-'}</div>
            <div style="padding: 10px; text-align: center; width: 80px; box-sizing: border-box;">${j.stats.amarillas > 0 ? j.stats.amarillas : '-'}</div>
            <div style="padding: 10px; text-align: center; width: 80px; font-weight: bold; color: #3498DB; box-sizing: border-box;">${j.stats.asistencias > 0 ? j.stats.asistencias : '-'}</div>
        `;
        return row;
    };

    const tTitulares = document.getElementById('pdf-tbody-titulares'); tTitulares.innerHTML = '';
    titulares.forEach(j => tTitulares.appendChild(renderRow(j)));

    const tSuplentes = document.getElementById('pdf-tbody-suplentes'); tSuplentes.innerHTML = '';
    suplentes.forEach(j => tSuplentes.appendChild(renderRow(j)));

    const tDesconvocados = document.getElementById('pdf-tbody-desconvocados'); tDesconvocados.innerHTML = '';
    desconvocados.forEach(j => {
        const row = document.createElement('div');
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.borderBottom = "1px solid #e2e8f0";
        row.className = "avoid-page-break";
        row.innerHTML = `<div style="padding: 10px; text-align: left; flex: 1; color: #94a3b8; box-sizing: border-box;"><strong>${j.id}</strong> - ${j.alias} (No Convocado)</div>`;
        tDesconvocados.appendChild(row);
    });

    const tStaff = document.getElementById('pdf-tbody-staff'); tStaff.innerHTML = '';
    cuerpoTecnico.forEach(s => {
        const row = document.createElement('div');
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.borderBottom = "1px solid #e2e8f0";
        row.className = "avoid-page-break";
        row.innerHTML = `
            <div style="padding: 10px; text-align: center; width: 60px; color:#1C2C5B; box-sizing: border-box;">${iconosStaff[s.posicion] || '<i class="fa-solid fa-user"></i>'}</div>
            <div style="padding: 10px; text-align: left; flex: 1; box-sizing: border-box;"><strong>${s.alias}</strong> <span style="font-size:11px; color:#64748b; margin-left:5px;">${s.nombre || ''}</span></div>
            <div style="padding: 10px; text-align: right; width: 150px; font-size:12px; font-weight:bold; box-sizing: border-box;">${nombresRolesStaff[s.posicion] || 'Staff'}</div>
        `;
        tStaff.appendChild(row);
    });

    const sectionCambios = document.getElementById('pdf-section-cambios');
    const tCambios = document.getElementById('pdf-tbody-cambios');
    tCambios.innerHTML = '';
    
    const cambios = partidoData.cronologia.filter(c => c.meta && c.meta.tipo === 'cambio');

    if (cambios.length > 0) {
        sectionCambios.style.display = 'block';
        cambios.forEach(c => {
            const jEntra = partidoData.plantilla.find(j => j.id === c.meta.entraId) || { alias: 'Desconocido' };
            const jSale = partidoData.plantilla.find(j => j.id === c.meta.saleId) || { alias: 'Desconocido' };
            const esLesion = c.descripcion.includes('lesión');

            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.borderBottom = "1px solid #e2e8f0";
            row.className = "avoid-page-break";
            row.innerHTML = `
                <div style="padding: 10px; text-align: center; width: 60px; font-weight:bold; color:#1C2C5B; font-size: 13px; box-sizing: border-box;">${c.minuto}</div>
                <div style="padding: 10px; text-align: left; flex: 1; font-weight:bold; font-size: 13px; box-sizing: border-box;">
                    <span style="color:#2ECC71; margin-right:5px;"><i class="fa-solid fa-arrow-up"></i></span> ${jEntra.alias}
                </div>
                <div style="padding: 10px; text-align: left; flex: 1; font-weight:bold; font-size: 13px; box-sizing: border-box;">
                    <span style="color:#D12229; margin-right:5px;"><i class="fa-solid fa-arrow-down"></i></span> ${jSale.alias} ${esLesion ? '🚑' : ''}
                </div>
            `;
            tCambios.appendChild(row);
        });
    } else {
        sectionCambios.style.display = 'none';
    }

    const element = document.getElementById('pdf-content');
    
    const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     `Reporte_ATM_vs_${rival}.pdf`,
        image:        { type: 'jpeg', quality: 1 }, 
        pagebreak:    { mode: 'css', avoid: '.avoid-page-break' },
        html2canvas:  { 
            scale: 3, 
            useCORS: true, 
            allowTaint: true,
            letterRendering: true,
            windowWidth: 790, 
            width: 790,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: function(clonedDoc) {
                clonedDoc.getElementById('pdf-wrapper').style.visibility = 'visible';
            }
        }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };
    
    const btnPDF = document.querySelector('[data-label="PDF"] i');
    if (btnPDF) btnPDF.className = "fa-solid fa-spinner fa-spin";

    html2pdf().set(opt).from(element).output('blob').then(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = opt.filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            if (btnPDF) btnPDF.className = "fa-solid fa-file-pdf";
        }, 100);
        
    }).catch(err => {
        console.error("Error al generar PDF:", err);
        alert("Fallo al crear el PDF. Prueba de nuevo.");
        if (btnPDF) btnPDF.className = "fa-solid fa-file-pdf";
    });
};