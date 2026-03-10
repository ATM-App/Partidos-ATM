let equiposLocal = {}; 

function cargarEquipos() {
    const list = document.getElementById('login-equipo-list');
    list.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando equipos...</span>';
    
    // Usamos .get() en lugar de onSnapshot para evitar que se quede pensando en bucle si hay mala conexión
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
        console.error("Error Firebase:", err);
        // Si hay microcorte, mostramos botón de reintento en lugar de quedarse congelado
        list.innerHTML = `
            <div style="text-align:center; width:100%; padding: 10px 0;">
                <span style="color:var(--atm-red); font-size:0.85rem; display:block; margin-bottom:10px;">La conexión a internet es débil o inestable.</span>
                <button class="btn-solid" style="background:var(--atm-blue); width:auto; margin:auto; padding:8px 15px; font-size: 0.85rem;" onclick="cargarEquipos()"><i class="fa-solid fa-rotate-right"></i> Reintentar Conexión</button>
            </div>
        `;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    
    cargarEquipos();

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

    document.getElementById('btn-descartar-vivo').addEventListener('click', () => {
        const id = document.getElementById('login-equipo-id').value;
        if(!id) return;
        
        if(confirm("¿Seguro que quieres borrar el partido guardado en memoria y empezar uno nuevo limpio?")) {
            localStorage.removeItem('atletiProMatchState_' + id);
            
            document.getElementById('alerta-partido-vivo').style.display = 'none';
            const btnEntrar = document.getElementById('btn-entrar');
            btnEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar al Campo';
            btnEntrar.style.background = ''; 
            
            alert("Partido anterior descartado. Puedes entrar para iniciar uno nuevo.");
        }
    });
});

window.seleccionarEquipoLogin = function(id, btnDOM) {
    document.getElementById('login-equipo-id').value = id;
    document.querySelectorAll('#login-equipo-list .pill-btn').forEach(b => b.classList.remove('active'));
    btnDOM.classList.add('active');

    const savedState = localStorage.getItem('atletiProMatchState_' + id);
    const alerta = document.getElementById('alerta-partido-vivo');
    const btnEntrar = document.getElementById('btn-entrar');

    if (savedState) {
        alerta.style.display = 'block';
        btnEntrar.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Continuar Partido en Vivo';
        btnEntrar.style.background = 'linear-gradient(135deg, #1C2C5B, #2A4080)';
    } else {
        alerta.style.display = 'none';
        btnEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar al Campo';
        btnEntrar.style.background = ''; 
    }
};