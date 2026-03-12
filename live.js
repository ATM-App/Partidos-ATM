const urlParams = new URLSearchParams(window.location.search);
const equipoId = urlParams.get('id');

if (!equipoId) {
    document.body.innerHTML = "<div class='no-match-panel'><h2>Error</h2><p>Enlace de equipo no válido.</p></div>";
} else {
    iniciarVisorPublico();
}

function iniciarVisorPublico() {
    // Primero obtenemos el nombre del equipo para la pantalla de espera
    db.collection("Equipos").doc(equipoId).get().then(doc => {
        if(doc.exists) document.getElementById('nombre-equipo-espera').innerText = doc.data().nombre;
    });

    // Escuchamos el partido en vivo
    db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const pData = JSON.parse(data.partidoData);

            document.getElementById('pantalla-espera').style.display = 'none';
            document.getElementById('pantalla-viva').style.display = 'block';

            // Actualizar Marcador
            document.getElementById('live-score-atm').innerText = data.scoreAtm;
            document.getElementById('live-score-rival').innerText = data.scoreRival;
            document.getElementById('live-rival-name').innerText = data.rival.toUpperCase();
            document.getElementById('live-status-public').innerText = pData.estado.replace('_', ' ');

            // Actualizar Cronología
            const cronoUl = document.getElementById('cronologia-publica');
            cronoUl.innerHTML = '';
            [...pData.cronologia].reverse().forEach(e => {
                cronoUl.innerHTML += `
                    <li style="display: flex; gap: 15px; padding: 10px 0; border-bottom: 1px solid #eee; align-items: center;">
                        <span style="font-weight: bold; color: var(--atm-red); min-width: 35px;">${e.minuto}</span>
                        <span style="font-size: 1.2rem;">${e.icono}</span>
                        <div>
                            <div style="font-weight: bold; font-size: 0.9rem;">${e.tipo}</div>
                            <div style="font-size: 0.8rem; color: #666;">${e.descripcion}</div>
                        </div>
                    </li>`;
            });

            // Dibujar Jugadores en el campo
            renderizarCampoPublico(pData);
            
            // Reloj en vivo (simple para el visor)
            if (pData.estado.includes('parte')) {
                const ahora = Date.now();
                const seg = Math.floor((ahora - pData.inicioPeriodoTimestamp) / 1000);
                const base = pData.estado === 'segunda_parte' ? Math.floor(pData.segundosAcumuladosPrimera / 60) : 0;
                const min = base + Math.floor(seg / 60);
                const s = (seg % 60).toString().padStart(2, '0');
                document.getElementById('live-timer-public').innerText = `${min}:${s}`;
            }

        } else {
            document.getElementById('pantalla-espera').style.display = 'flex';
            document.getElementById('pantalla-viva').style.display = 'none';
        }
    });
}

function renderizarCampoPublico(pData) {
    const campo = document.getElementById('contenedor-campo-publico');
    campo.innerHTML = '';
    pData.plantilla.forEach(j => {
        if (j.enCampo) {
            const node = document.createElement('div');
            node.className = 'player-node';
            node.style.top = j.posY;
            node.style.left = j.posX;
            node.style.transition = "all 0.5s ease"; // Movimiento suave para los padres
            
            node.innerHTML = `
                <div class="player-circle ${j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm'}" style="width:25px; height:25px; font-size:0.6rem;">${j.id}</div>
                <span class="player-name" style="font-size:0.5rem;">${j.alias}</span>
            `;
            campo.appendChild(node);
        }
    });
}