const urlParams = new URLSearchParams(window.location.search);
const equipoId = urlParams.get('id');

if (!equipoId) {
    document.body.innerHTML = "<div class='no-match-panel'><h2>Error</h2><p>Enlace de equipo no válido.</p></div>";
} else {
    iniciarVisorPublico();
}

function iniciarVisorPublico() {
    db.collection("Equipos").doc(equipoId).get().then(doc => {
        if(doc.exists) document.getElementById('nombre-equipo-espera').innerText = doc.data().nombre;
    });

    db.collection(`Equipos/${equipoId}/LiveMatch`).doc('State').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const pData = JSON.parse(data.partidoData);

            document.getElementById('pantalla-espera').style.display = 'none';
            document.getElementById('pantalla-viva').style.display = 'block';

            document.getElementById('live-score-atm').innerText = data.scoreAtm;
            document.getElementById('live-score-rival').innerText = data.scoreRival;
            document.getElementById('live-rival-name').innerText = data.rival.toUpperCase();
            document.getElementById('live-status-public').innerText = pData.estado.toUpperCase().replace('_', ' ');

            // Cronología con scroll (Muestra TODO)
            const cronoUl = document.getElementById('cronologia-publica');
            cronoUl.innerHTML = '';
            [...pData.cronologia].reverse().forEach(e => {
                cronoUl.innerHTML += `
                    <li style="display: flex; gap: 15px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; align-items: center;">
                        <span style="font-weight: bold; color: #D12229; min-width: 40px; font-size: 0.85rem;">${e.minuto}</span>
                        <span style="font-size: 1.3rem;">${e.icono}</span>
                        <div>
                            <div style="font-weight: bold; font-size: 0.9rem; color: #1C2C5B;">${e.tipo}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">${e.descripcion}</div>
                        </div>
                    </li>`;
            });

            renderizarCampoPublico(pData);
            
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
            node.style.transition = "all 0.6s cubic-bezier(0.23, 1, 0.32, 1)"; // Movimiento suave
            
            // Lógica de foto: Si tiene foto se pone, si no, el círculo oficial
            let fotoStyle = '';
            let fotoClass = '';
            let shirtClass = j.posicion === 'portero' ? 'bg-portero-black' : 'shirt-pattern-atm';

            if (j.foto && j.foto !== "") {
                fotoStyle = `background-image: url('${j.foto}');`;
                fotoClass = 'has-photo';
            }

            node.innerHTML = `
                <div class="player-circle ${shirtClass} ${fotoClass}" style="${fotoStyle} width:32px; height:32px; font-size:0.7rem; border: 2px solid white;">
                    ${fotoClass ? '' : j.id}
                </div>
                <span class="player-name" style="font-size:0.55rem; background: rgba(28, 44, 91, 0.8); color: white; padding: 1px 4px; border-radius: 4px; margin-top: 2px;">${j.alias}</span>
            `;
            campo.appendChild(node);
        }
    });
}