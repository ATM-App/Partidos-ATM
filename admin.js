let equipoSeleccionadoId = null;
let fotoBase64Nueva = ""; 
let fotoBase64Edit = "";  
let adminAuthDoc = db.collection("Config").doc("AdminAuth");
let realAdminPass = "adminATM"; 

document.addEventListener("DOMContentLoaded", () => {
    
    adminAuthDoc.onSnapshot(doc => {
        if (!doc.exists) {
            adminAuthDoc.set({ password: "adminATM" });
        } else {
            realAdminPass = doc.data().password;
        }
    });

    document.getElementById('btn-admin-login').addEventListener('click', verificarLoginAdmin);
    document.getElementById('input-admin-password').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') verificarLoginAdmin();
    });

    function verificarLoginAdmin() {
        const inputPass = document.getElementById('input-admin-password').value;
        const btn = document.getElementById('btn-admin-login');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
        btn.disabled = true;
        
        setTimeout(() => {
            if (inputPass === realAdminPass) {
                document.getElementById('admin-login-overlay').classList.remove('active');
                cargarEquiposSelect(); 
            } else {
                alert("Contraseña incorrecta. Inténtalo de nuevo.");
                btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Entrar al Panel';
                btn.disabled = false;
                document.getElementById('input-admin-password').value = '';
            }
        }, 50);
    }

    document.getElementById('new-admin-password').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') guardarNuevaPassAdmin();
    });

    function comprimirImagen(file, callback) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 150; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('jugador-foto').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            comprimirImagen(file, (base64) => { fotoBase64Nueva = base64; });
        } else {
            fotoBase64Nueva = "";
        }
    });

    document.getElementById('edit-jugador-foto').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            comprimirImagen(file, (base64) => { fotoBase64Edit = base64; });
        }
    });

    document.getElementById('btn-crear-equipo').addEventListener('click', async () => {
        const nombre = document.getElementById('admin-nombre-equipo').value.trim();
        const modalidad = document.getElementById('admin-modalidad').value;
        const password = document.getElementById('admin-password').value.trim();

        if(!nombre || !password) return alert("Rellena nombre y contraseña.");

        const btn = document.getElementById('btn-crear-equipo');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            const query = await db.collection("Equipos").where("nombre", "==", nombre).get();
            if(!query.empty) {
                btn.innerHTML = '<i class="fa-solid fa-plus"></i> Guardar Equipo';
                btn.disabled = false;
                return alert("¡Error! Ya existe un equipo con ese nombre.");
            }

            await db.collection("Equipos").add({ nombre, modalidad, password, fechaCreacion: new Date() });
            alert(`¡Equipo ${nombre} creado!`);
            document.getElementById('admin-nombre-equipo').value = '';
            document.getElementById('admin-password').value = '';
            
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Guardar Equipo';
            btn.disabled = false;
        } catch (e) { 
            alert("Error: " + e.message); 
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Guardar Equipo';
            btn.disabled = false;
        }
    });

    document.getElementById('btn-actualizar-nombre').addEventListener('click', async () => {
        const nuevoNombre = document.getElementById('edit-nombre-equipo').value.trim();
        if(!nuevoNombre) return alert("Escribe un nombre de equipo válido.");
        try {
            await db.collection("Equipos").doc(equipoSeleccionadoId).update({ nombre: nuevoNombre });
            alert("Nombre del equipo actualizado con éxito.");
        } catch (e) { alert("Error al actualizar: " + e.message); }
    });

    document.getElementById('btn-actualizar-password').addEventListener('click', async () => {
        const nuevaPass = document.getElementById('edit-password').value.trim();
        if(!nuevaPass) return alert("Escribe la nueva contraseña.");
        try {
            await db.collection("Equipos").doc(equipoSeleccionadoId).update({ password: nuevaPass });
            alert("Contraseña del equipo actualizada con éxito.");
            document.getElementById('edit-password').value = '';
        } catch (e) { alert("Error al actualizar: " + e.message); }
    });

    document.getElementById('btn-eliminar-equipo').addEventListener('click', async () => {
        const confirm1 = confirm("⚠️ ATENCIÓN: ¿Estás seguro de que quieres ELIMINAR este equipo por completo?");
        if (!confirm1) return;
        
        const confirm2 = confirm("🚨 ÚLTIMO AVISO: Esta acción es irreversible. Se borrará el acceso al equipo. ¿Confirmar eliminación definitiva?");
        if (!confirm2) return;

        try {
            await db.collection("Equipos").doc(equipoSeleccionadoId).delete();
            alert("Equipo eliminado definitivamente.");
            document.getElementById('panel-edicion').classList.add('hidden');
            equipoSeleccionadoId = null;
        } catch (e) {
            alert("Error al eliminar el equipo: " + e.message);
        }
    });

    document.getElementById('btn-anadir-jugador').addEventListener('click', () => {
        const dorsalInput = document.getElementById('jugador-numero').value;
        const alias = document.getElementById('jugador-alias').value;
        const nombre = document.getElementById('jugador-nombre').value;
        const posicion = document.getElementById('jugador-posicion').value;

        if(!alias) return alert("El Alias es obligatorio.");
        
        // Si es un staff y no le ponen dorsal, le asignamos 0 temporalmente para que no pete la BD
        const idFinal = dorsalInput === '' ? 0 : parseInt(dorsalInput);

        db.collection(`Equipos/${equipoSeleccionadoId}/Jugadores`).add({
            id: idFinal, alias, nombre, posicion, foto: fotoBase64Nueva, enCampo: false, minutosJugados: 0,
            stats: { goles: 0, amarillas: 0, rojas: 0, asistencias: 0 }
        }).then(() => {
            document.getElementById('jugador-numero').value = '';
            document.getElementById('jugador-alias').value = '';
            document.getElementById('jugador-nombre').value = '';
            document.getElementById('jugador-foto').value = '';
            fotoBase64Nueva = ""; 
        });
    });
});

window.guardarNuevaPassAdmin = async function() {
    const newPass = document.getElementById('new-admin-password').value.trim();
    if(!newPass) return alert("Por favor, introduce una contraseña válida.");
    
    try {
        await adminAuthDoc.set({ password: newPass });
        alert("¡Contraseña maestra de administración actualizada con éxito!");
        document.getElementById('new-admin-password').value = '';
        cerrarModalAdmin();
    } catch(e) {
        alert("Error al guardar la nueva contraseña: " + e.message);
    }
};

window.selectModalidad = function(val, btnDOM) {
    document.getElementById('admin-modalidad').value = val;
    document.querySelectorAll('#grupo-modalidad-admin .pill-btn').forEach(b => b.classList.remove('active'));
    btnDOM.classList.add('active');
};

window.seleccionarEquipoAdmin = function(id, nombreEquipo, btnDOM) {
    equipoSeleccionadoId = id;
    document.getElementById('select-equipos-creados').value = id;
    document.getElementById('edit-nombre-equipo').value = nombreEquipo; 
    
    document.querySelectorAll('#admin-equipo-list .pill-btn').forEach(b => b.classList.remove('active'));
    btnDOM.classList.add('active');
    
    document.getElementById('panel-edicion').classList.remove('hidden');
    cargarJugadoresDelEquipo(id);
};

function cargarEquiposSelect() {
    const list = document.getElementById('admin-equipo-list');
    list.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</span>';
    
    db.collection("Equipos").onSnapshot((snap) => {
        list.innerHTML = '';
        if(snap.empty) {
            list.innerHTML = '<span style="color:var(--text-muted);">No hay equipos creados.</span>';
            return;
        }
        snap.forEach(doc => {
            const data = doc.data();
            const nombreSafe = data.nombre.replace(/'/g, "\\'");
            list.innerHTML += `<button type="button" class="pill-btn" onclick="seleccionarEquipoAdmin('${doc.id}', '${nombreSafe}', this)">${data.nombre}</button>`;
        });
    }, err => {
        list.innerHTML = '<span style="color:var(--atm-red);">Error de conexión.</span>';
    });
}

let unsubscribeJugadores = null;
function cargarJugadoresDelEquipo(id) {
    const lista = document.getElementById('lista-plantilla-admin');
    lista.innerHTML = '<li style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando miembros...</li>';
    
    if (unsubscribeJugadores) unsubscribeJugadores();

    unsubscribeJugadores = db.collection(`Equipos/${id}/Jugadores`).orderBy("id").onSnapshot((snap) => {
        lista.innerHTML = '';
        if(snap.empty) {
            lista.innerHTML = '<li style="color:var(--text-muted);">Plantilla vacía.</li>';
            return;
        }
        snap.forEach(doc => {
            const j = doc.data();
            const iconoFoto = j.foto && j.foto !== "" ? '<i class="fa-solid fa-image" style="color:var(--atm-red); margin-left:8px;"></i>' : '';
            // Si es staff y no le pusieron dorsal, ponemos ST (Staff) en el frontend
            const dorsalMostrar = j.id === 0 ? 'ST' : j.id;

            lista.innerHTML += `<li class="list-item-dense" style="margin-bottom:5px; padding:10px; cursor:pointer;" 
                onclick="prepararModalEditar('${doc.id}')">
                <div><strong>${dorsalMostrar}</strong> - ${j.alias} <small style="color:var(--text-muted); text-transform:uppercase;">(${j.posicion})</small> ${iconoFoto}</div>
                <i class="fa-solid fa-pen" style="color:var(--text-muted); font-size:0.85rem;"></i>
            </li>`;
        });
    });
}

window.prepararModalEditar = async function(docId) {
    const doc = await db.collection(`Equipos/${equipoSeleccionadoId}/Jugadores`).doc(docId).get();
    if(!doc.exists) return;
    const j = doc.data();

    document.getElementById('edit-jugador-doc-id').value = docId;
    document.getElementById('edit-jugador-numero').value = j.id === 0 ? '' : j.id;
    document.getElementById('edit-jugador-alias').value = j.alias;
    document.getElementById('edit-jugador-nombre').value = j.nombre || '';
    document.getElementById('edit-jugador-posicion').value = j.posicion;
    document.getElementById('edit-jugador-foto').value = ''; 
    
    fotoBase64Edit = j.foto || ''; 
    
    document.getElementById('modal-editar-jugador').classList.add('active');
};

window.cerrarModalAdmin = function() {
    document.querySelectorAll('.overlay').forEach(m => m.classList.remove('active'));
};

window.guardarEdicionJugador = async function() {
    const docId = document.getElementById('edit-jugador-doc-id').value;
    const dorsalInput = document.getElementById('edit-jugador-numero').value;
    const alias = document.getElementById('edit-jugador-alias').value;
    const nombre = document.getElementById('edit-jugador-nombre').value;
    const posicion = document.getElementById('edit-jugador-posicion').value;

    if(!alias) return alert("El Alias es obligatorio.");
    const idFinal = dorsalInput === '' ? 0 : parseInt(dorsalInput);

    try {
        await db.collection(`Equipos/${equipoSeleccionadoId}/Jugadores`).doc(docId).update({
            id: idFinal, alias: alias, nombre: nombre, posicion: posicion, foto: fotoBase64Edit
        });
        cerrarModalAdmin();
    } catch (e) {
        alert("Error al actualizar el miembro: " + e.message);
    }
};

window.eliminarJugador = async function() {
    if(!confirm("¿Estás seguro de que quieres eliminar a este miembro? Esta acción no se puede deshacer.")) return;
    
    const docId = document.getElementById('edit-jugador-doc-id').value;
    try {
        await db.collection(`Equipos/${equipoSeleccionadoId}/Jugadores`).doc(docId).delete();
        cerrarModalAdmin();
    } catch (e) {
        alert("Error al eliminar el miembro: " + e.message);
    }
};