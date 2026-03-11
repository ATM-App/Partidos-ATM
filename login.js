let equiposLocal = {}; 

function iniciarCargaEquipos() {
    const list = document.getElementById('login-equipo-list');
    
    if (!list.innerHTML.includes('Cargando')) {
        list.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando equipos...</span>';
    }

    db.collection("Equipos").get().then((snap) => {
        list.innerHTML = '';
        equiposLocal = {}; 
        
        if(snap.empty) {
            list.innerHTML = '<span style="color:var(--text-muted);">No hay equipos creados.</span>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            equiposLocal[doc.id] = data; 
            list.innerHTML += `<button type="button" class="pill-btn" onclick="seleccionarEquipoLogin('${doc.id}', this)">${data.nombre}</button>`;
        });

    }).catch((err) => {
        setTimeout(iniciarCargaEquipos, 500);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    iniciarCargaEquipos();

    document.getElementById('btn-entrar').addEventListener('click', () => {
        const id = document.getElementById('login-equipo-id').value;
        const pass = document.getElementById('login-password').value;
        
        if (!id) return alert("Por favor, selecciona un equipo tocando su nombre.");
        if (!pass) return alert("Introduce la contraseña del equipo.");

        const btnEntrar = document.getElementById('btn-entrar');
        const textoOriginal = btnEntrar.innerHTML;
        btnEntrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
        btnEntrar.disabled = true;

        setTimeout(() => {
            const equipo = equiposLocal[id];
            if (equipo && equipo.password === pass) {
                sessionStorage.setItem('equipoActivoId', id);
                sessionStorage.setItem('equipoModalidad', equipo.modalidad);
                window.location.href = 'index.html';
            } else { 
                alert("Contraseña incorrecta."); 
                btnEntrar.innerHTML = textoOriginal;
                btnEntrar.disabled = false;
            }
        }, 50); 
    });

    document.getElementById('btn-descartar-vivo').addEventListener('click', async () => {
        const id = document.getElementById('login-equipo-id').value;
        if(!id) return;
        
        if(confirm("¿Seguro que quieres borrar el partido alojado en la nube y empezar uno nuevo limpio?")) {
            
            // AHORA BORRA EL PARTIDO EN VIVO DE LA NUBE PARA TODOS LOS DISPOSITIVOS
            await db.collection(`Equipos/${id}/LiveMatch`).doc('State').delete();
            
            document.getElementById('alerta-partido-vivo').style.display = 'none';
            const btnEntrar = document.getElementById('btn-entrar');
            btnEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar al Campo';
            btnEntrar.style.background = ''; 
            
            alert("Partido en la nube descartado. Puedes entrar para iniciar uno nuevo.");
        }
    });
});

window.seleccionarEquipoLogin = async function(id, btnDOM) {
    document.getElementById('login-equipo-id').value = id;
    document.querySelectorAll('#login-equipo-list .pill-btn').forEach(b => b.classList.remove('active'));
    btnDOM.classList.add('active');

    const alerta = document.getElementById('alerta-partido-vivo');
    const btnEntrar = document.getElementById('btn-entrar');
    
    // COMPROBAMOS LA NUBE EN TIEMPO REAL
    btnEntrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comprobando Nube...';
    btnEntrar.disabled = true;

    try {
        const liveDoc = await db.collection(`Equipos/${id}/LiveMatch`).doc('State').get();
        if (liveDoc.exists) {
            const data = liveDoc.data();
            const pData = JSON.parse(data.partidoData);
            if (pData.estado !== 'finalizado') {
                alerta.style.display = 'block';
                btnEntrar.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Continuar Partido en Vivo';
                btnEntrar.style.background = 'linear-gradient(135deg, #1C2C5B, #2A4080)';
            } else {
                alerta.style.display = 'none';
                btnEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar al Campo';
                btnEntrar.style.background = ''; 
            }
        } else {
            alerta.style.display = 'none';
            btnEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar al Campo';
            btnEntrar.style.background = ''; 
        }
    } catch (e) {
        alerta.style.display = 'none';
        btnEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar al Campo';
        btnEntrar.style.background = ''; 
    }
    
    btnEntrar.disabled = false;
};