//const API_URL = "https://cors-anywhere.herokuapp.com/http://3.12.76.155:8000/api";
const API_URL = "https://projetofotografo.zapto.org/api";
// autorização 1hr: https://cors-anywhere.herokuapp.com/corsdemo

let imageMap = {}; // Mapeamento ID -> Nome da imagem
let isProcessing = false; // Evita chamadas duplicadas no álbum
let isLoadingAlbums = false; // Evita múltiplas chamadas ao carregar álbuns

// Verifica se o álbum existe antes de carregar
async function checkAndLoadAlbum(albumId) {
    if (!albumId) {
        console.warn("⚠️ Nenhum albumId fornecido!");
        alert("Álbum inválido! Retornando à página inicial.");
        window.location.href = "index.html";
        return;
    }

    try {
        console.log(`Verificando existência do álbum: ${albumId}...`);

        const response = await fetch(`${API_URL}/albums/${albumId}`);

        if (!response.ok) {
            console.warn(`ALERTA: Álbum não encontrado! Código: ${response.status}`);

            if (response.status === 404) {
                alert("Este álbum não existe ou foi excluído!");
                window.location.href = "index.html"; // Redireciona para a página principal
                return;
            }

            throw new Error(`Erro ao verificar álbum (Status: ${response.status})`);
        }

        console.log("Álbum encontrado! Carregando imagens...");
        refreshAlbum(albumId); // Agora podemos carregar as imagens com segurança

    } catch (error) {
        console.error("Erro ao verificar o álbum:", error);
        alert("Erro ao verificar álbum. Tente novamente mais tarde.");
        window.location.href = "index.html";
    }
}

// Atualiza e carrega imagens corretamente, com verificação se o álbum existe
let isAlbumDeleted = false; // Flag para evitar loop infinito

async function refreshAlbum(albumId, forceUpdate = false) {
    if (isProcessing && !forceUpdate) {
        console.warn("⚠️ Já está processando! Ignorando nova chamada.");
        return;
    }
    if (isAlbumDeleted) {
        console.warn("ALERTA: O álbum foi excluído. Não faremos novas tentativas.");
        return;
    }

    isProcessing = true;

    try {
        console.log("Iniciando refreshAlbum para albumId:", albumId);
        if (!albumId) {
            console.warn("⚠️ Nenhum albumId encontrado na URL!");
            return;
        }

        const gallery = document.getElementById("image-gallery");
        if (!gallery) {
            console.warn("⚠️ Elemento #image-gallery não encontrado!");
            return;
        }
        // Mostra o loader
        gallery.classList.add("loading");
        gallery.innerHTML = '<div class="loader"></div>';

        // Verifica primeiro se o álbum existe
        let response = await fetch(`${API_URL}/albums/${albumId}/images`);

        if (!response.ok) {
            console.warn("ALERTA: O álbum não existe ou foi excluído! Código:", response.status);

            if (response.status === 404) {
                isAlbumDeleted = true; // Marca que o álbum foi excluído

                gallery.innerHTML = `<p style=" color: #e01f34; width: 100vw;text-align: center;color: #e01f34;">Este álbum foi excluído ou não existe.</p>`;

                setTimeout(() => {
                    window.location.href = "index.html"; // Redireciona para a página inicial
                }, 3000);

                return;
            }

            throw new Error(`Erro ao carregar álbum (Status: ${response.status})`);
        } 

        let data = await response.json();

        if (Array.isArray(data.images) && data.images.length > 0) {
            console.log("Imagens carregadas com sucesso!");
            displayImages(data.images);
        } else {
            console.warn("⚠️ Nenhuma imagem encontrada.");
            gallery.innerHTML = "<p style='color: #e01f34; width: 100vw; text-align: center;'>Nenhuma imagem disponível.</p>";
        }
    } catch (error) {
        console.error("Erro ao atualizar o álbum:", error);
        const gallery = document.getElementById("image-gallery");
        if (gallery) {
            gallery.innerHTML = "<p style='color: #e01f34; width: 100vw; text-align: center;'>Erro ao carregar as imagens. Tente novamente mais tarde.</p>";
        }
    } finally {
        isProcessing = false;
        const gallery = document.getElementById("image-gallery");
        if (gallery) gallery.classList.remove("loading");
    }
}

// Inicia o carregamento ao abrir a página *com verificação se o álbum existe*
document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
        console.log("Carregando lista de álbuns...");
        loadAlbums();
    } else {
        console.log("Página carregada dentro de um álbum, verificando existência...");

        if (!isProcessing) {
            isProcessing = true;
        } else {
            console.warn("⚠️ Ignorando chamada duplicada de refreshAlbum.");
        }
    }
});

// Exibe imagens conforme forem carregando
function displayImages(images) {
    const gallery = document.getElementById("image-gallery");
    if (!gallery) return;

    gallery.innerHTML = ""; // Limpa a galeria antes de carregar as novas imagens
    imageMap = {};

    images.forEach(image => {
        imageMap[image.id] = image.name;

        // Cria o container pra foto
        const container = document.createElement("div");
        container.classList.add("photo-container");

        // Cria a imagem
        const img = document.createElement("img");
        img.src = `https://drive.google.com/thumbnail?id=${image.id}`;
        img.alt = image.name;
        img.loading = "lazy";
        img.classList.add("fade-in");

        // Quando clicar na imagem, abre o link completo
        img.onclick = (e) => {
            // Evita que o clique no container se repita
            e.stopPropagation();
            window.open(image.url, "_blank");
        };

        // Cria a bolinha de seleção
        const selectionCircle = document.createElement("div");
        selectionCircle.classList.add("selection-circle");

        // Ao clicar no container, alterna o estado selecionado
        container.addEventListener("click", function(e) {
            container.classList.toggle("selected");
        });

        container.appendChild(img);
        container.appendChild(selectionCircle);
        gallery.appendChild(container);
    });

    console.log("Imagens carregadas com sucesso!");
}


// Envia selfie e busca rostos similares
async function uploadSelfie() {
    // Pega os inputs
    const fileInput = document.getElementById("fileInput");
    const cameraInput = document.getElementById("cameraInput");

    let file = null;

    // Verifica se o input da câmera tem arquivo
    if (cameraInput && cameraInput.files && cameraInput.files.length > 0) {
        file = cameraInput.files[0];
    }
    // Se não, verifica o input do arquivo
    else if (fileInput && fileInput.files && fileInput.files.length > 0) {
        file = fileInput.files[0];
    }

    if (!file) {
        alert("Selecione uma imagem para enviar.");
        return;
    }

    const albumId = new URLSearchParams(window.location.search).get("album");
    if (!albumId) {
        console.error("⚠️ Nenhum albumId encontrado!");
        return;
    }

    // Mostra o loader e remove as fotos atuais
    const gallery = document.getElementById("image-gallery");
    if (gallery) {
        gallery.innerHTML = '<div class="loader"></div>';
    }

    try {
        console.log("Enviando selfie para comparação...");
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_URL}/albums/${albumId}/upload-selfie?max_faces=5&threshold=70`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            console.error("Erro ao enviar selfie:", response.status);
            alert("Erro ao enviar selfie. Tente novamente.");
            if (gallery) gallery.innerHTML = "";
            return;
        }

        const data = await response.json();
        console.log("Resultado da API:", data);

        if (!data.matches || data.matches.length === 0) {
            console.warn("⚠️ Nenhuma imagem similar encontrada.");
            if (gallery) gallery.innerHTML = "<p style='color: #e01f34; width: 100vw; text-align: center;'>Nenhuma correspondência encontrada.</p>";
            return;
        }

        displayMatchingImages(data.matches);
    } catch (error) {
        console.error("Erro ao enviar selfie:", error);
        if (gallery) gallery.innerHTML = "<p style=' color: #e01f34; width: 100vw; text-align: center;'>Erro ao processar sua imagem. Tente novamente mais tarde.</p>";
    }
}


// Exibe os rostos mais similares encontrados
function displayMatchingImages(matches) {
    const gallery = document.getElementById("image-gallery");
    if (!gallery) return;

    gallery.innerHTML = ""; // Limpa a galeria

    if (!Array.isArray(matches) || matches.length === 0) {
        console.warn("⚠️ Nenhuma imagem similar encontrada.");
        gallery.innerHTML = "<p>Nenhuma imagem correspondente.</p>";
        return;
    }

    matches.forEach(match => {
        // Cria um container pra cada foto
        const container = document.createElement("div");
        container.classList.add("photo-container");

        // Cria a imagem
        const img = document.createElement("img");
        img.src = `https://drive.google.com/thumbnail?id=${match.image_id}`;
        img.alt = "";
        img.loading = "lazy";
        img.classList.add("fade-in");

        // Cria a bolinha de seleção
        const selectionCircle = document.createElement("div");
        selectionCircle.classList.add("selection-circle");

        // Quando clicar no container, alterna a classe "selected"
        container.addEventListener("click", function(e) {
            // Evita conflito se precisar tratar outros cliques
            container.classList.toggle("selected");
        });

        container.appendChild(img);
        container.appendChild(selectionCircle);
        gallery.appendChild(container);
    });

    console.log("Imagens similares carregadas!");
}


// Carrega os álbuns *apenas se não estiver sendo carregado*
async function loadAlbums() {
    if (isLoadingAlbums) {
        console.warn("⚠️ Já está carregando os álbuns! Ignorando nova chamada.");
        return;
    }
    isLoadingAlbums = true;

    const albumContainer = document.getElementById("album-container");
    if (!albumContainer) {
        console.warn("⚠️ Página sem #album-container, pulando carregamento de álbuns.");
        return;
    }
    // Mostra o loader
    albumContainer.classList.add("loading");
    albumContainer.innerHTML = '<div class="loader"></div>';

    try {
        console.log("Buscando álbuns...");
        const response = await fetch(`${API_URL}/main/folders`);

        if (!response.ok) {
            console.warn(`ALERTA: Erro na API: ${response.status}`);
            throw new Error("Erro ao carregar álbuns.");
        }

        const data = await response.json();
        console.log("Álbuns recebidos:", data);

        albumContainer.innerHTML = "";

        if (!Array.isArray(data.folders) || data.folders.length === 0) {
            console.warn("⚠️ Nenhum álbum encontrado!");
            albumContainer.innerHTML = "<p style='width: 100vw; text-align: center;'>Nenhum álbum disponível.</p>";
            return;
        }

        data.folders.forEach(album => {
            const albumCard = document.createElement("div");
            albumCard.classList.add("album-card");
            albumCard.innerText = album.name;
            albumCard.onclick = () => window.location.href = `album.html?album=${album.id}`;

            albumContainer.appendChild(albumCard);
        });

        console.log("Álbuns exibidos com sucesso!");
    } catch (error) {
        console.error("Erro ao carregar álbuns:", error);
        albumContainer.innerHTML = "<p style=' color: #e01f34; width: 100vw; text-align: center;'>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
    } finally {
        isLoadingAlbums = false;
        albumContainer.classList.remove("loading");
    }
}

// Inicia o carregamento ao abrir a página *somente se for necessário*
document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
        console.log("Carregando lista de álbuns...");
        loadAlbums();
    } else {
        console.log("Página carregada dentro de um álbum, tentando atualizar...");
        refreshAlbum(albumId, true);
    }

    // Garante que o botão também funcione manualmente
    const updateAlbumsBtn = document.getElementById("updateAlbumsBtn");
    if (updateAlbumsBtn) {
        updateAlbumsBtn.addEventListener("click", () => loadAlbums());
    }

    const updateAlbumBtn = document.getElementById("updateAlbumBtn");
    if (updateAlbumBtn) {
        updateAlbumBtn.addEventListener("click", () => refreshAlbum(albumId, true));
    }
});

// Botão para selecionar todas as fotos
document.getElementById("select-all-btn").addEventListener("click", function() {
    const containers = document.querySelectorAll(".photo-container");
    containers.forEach(container => container.classList.add("selected"));
});

// Botão para baixar fotos selecionadas
document.getElementById("download-selected-btn").addEventListener("click", async function() {
    const selectedContainers = document.querySelectorAll(".photo-container.selected");
    if (selectedContainers.length === 0) {
        alert("Nenhuma foto selecionada!");
        return;
    }
    if (selectedContainers.length === 1) {
        // Se só uma foto estiver selecionada, baixa direto
        const img = selectedContainers[0].querySelector("img");
        if (img && img.src) {
            window.location.href = img.src;
        }
    } else {
        // Se 2 ou mais, cria um ZIP com todas as imagens
        const zip = new JSZip();
        const folder = zip.folder("fotos_selecionadas");

        // Array de promises pra baixar cada imagem
        const fetchPromises = [];
        selectedContainers.forEach((container, index) => {
            const img = container.querySelector("img");
            if (img && img.src) {
                fetchPromises.push(
                    fetch(img.src)
                        .then(response => response.blob())
                        .then(blob => {
                            folder.file(`foto${index+1}.jpg`, blob);
                        })
                );
            }
        });

        Promise.all(fetchPromises).then(() => {
            zip.generateAsync({ type: "blob" })
                .then(function(content) {
                    // Cria um link temporário e dispara o download
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(content);
                    link.download = "fotos_selecionadas.zip";
                    link.click();
                });
        });
    }
});


// Expõe funções globalmente para evitar erro "loadAlbums is not defined"
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
