const API_URL = "https://projetofotografo.zapto.org/api";
let selectedImages = [];
let imageMap = {};
let isProcessing = false;
let isLoadingAlbums = false;

// Função genérica para requisições à API
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erro na requisição para ${endpoint}:`, error);
    throw error;
  }
}

// Debounce para evitar múltiplas chamadas simultâneas
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// Carrega álbuns com otimização
async function loadAlbums() {
  if (isLoadingAlbums) return;
  isLoadingAlbums = true;

  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) return;

  albumContainer.innerHTML = '<div class="loader"></div>';

  try {
    // Busca a lista de álbuns
    const data = await apiRequest("/main/folders");
    console.log("Álbuns retornados pela API:", data.folders);

    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      albumContainer.innerHTML = "<p>Nenhum álbum disponível.</p>";
      return;
    }

    // Busca as imagens do álbum FotosCapas
    const fotosCapasData = await apiRequest("/albums/FotosCapas/images");
    const fotosCapas = fotosCapasData.images || [];

    // Adiciona um console.log para exibir todas as imagens retornadas
    console.log("Todas as imagens retornadas do álbum FotosCapas:");
    fotosCapas.forEach(img => console.log(`Imagem: ${img.name}, ID: ${img.id}`));

    console.log("Imagens encontradas no álbum FotosCapas:");

    // Filtra as imagens cujo nome seja exatamente "FotosCapas"
    const filteredFotosCapas = fotosCapas.filter(img => img.name.trim().toLowerCase() === "fotoscapas");
    filteredFotosCapas.forEach(img => console.log(`Imagem filtrada: ${img.name}, ID: ${img.id}`));

    const fragment = document.createDocumentFragment();
    data.folders.forEach(album => {
      console.log(`Processando álbum: ${album.name}`);

      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");
      albumCard.innerHTML = `
        <img src="https://placehold.co/300x200?text=Carregando..." alt="Capa do Álbum" class="album-cover">
        <h3>${album.name}</h3>
      `;
      albumCard.onclick = () => window.location.href = `album.html?album=${album.id}`;
      fragment.appendChild(albumCard);

      // Busca a imagem de capa correspondente no álbum FotosCapas
      const coverImg = albumCard.querySelector(".album-cover");
      const fotoCapa = filteredFotosCapas.find(img => {
        const lowerAlbumName = album.name.trim().toLowerCase();
        const lowerImageName = img.name.trim().toLowerCase().replace(/\.(jpg|jpeg|png)$/, ""); // Remove a extensão
        console.log(`Comparando: "${lowerAlbumName}" com "${lowerImageName}"`);
        return lowerAlbumName === lowerImageName;
      });

      if (fotoCapa) {
        console.log(`Imagem de capa encontrada para o álbum "${album.name}":`, fotoCapa);
        coverImg.src = `https://drive.google.com/thumbnail?id=${fotoCapa.id}`;
      } else {
        console.log(`Nenhuma imagem de capa encontrada para o álbum "${album.name}"`);
        coverImg.src = "https://placehold.co/300x200?text=Sem+Capa";
      }
    });

    albumContainer.innerHTML = "";
    albumContainer.appendChild(fragment);
  } catch (error) {
    console.error("Erro ao carregar os álbuns ou as capas:", error);
    albumContainer.innerHTML = "<p>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
  } finally {
    isLoadingAlbums = false;
  }
}

// Carrega as imagens do álbum FotosCapas
async function loadFotosCapas() {
  try {
    // Busca as imagens do álbum FotosCapas
    const fotosCapasData = await apiRequest("/albums/FotosCapas/images");
    const fotosCapas = fotosCapasData.images || [];

    // Exibe todas as imagens retornadas no console
    console.log("Imagens retornadas do álbum FotosCapas:");
    fotosCapas.forEach(img => console.log(`Imagem: ${img.name}, ID: ${img.id}`));

    // Renderiza as imagens no DOM
    const fotosCapasContainer = document.getElementById("fotos-capas-container");
    if (!fotosCapasContainer) {
      console.error("Elemento com ID 'fotos-capas-container' não encontrado.");
      return;
    }

    const fragment = document.createDocumentFragment();
    fotosCapas.forEach(img => {
      const imgElement = document.createElement("img");
      imgElement.src = `https://drive.google.com/thumbnail?id=${img.id}`;
      imgElement.alt = img.name;
      imgElement.title = img.name;
      imgElement.classList.add("fotos-capas-image");
      fragment.appendChild(imgElement);
    });

    fotosCapasContainer.innerHTML = ""; // Limpa o contêiner antes de adicionar as imagens
    fotosCapasContainer.appendChild(fragment);
  } catch (error) {
    console.error("Erro ao carregar as imagens do álbum FotosCapas:", error);
  }
}

// Atualiza o álbum com otimização
async function refreshAlbum(albumId) {
  if (isProcessing) return;
  isProcessing = true;

  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  gallery.innerHTML = '<div class="loader"></div>';

  try {
    const data = await apiRequest(`/albums/${albumId}/images`);
    if (!Array.isArray(data.images) || data.images.length === 0) {
      gallery.innerHTML = "<p>Nenhuma imagem disponível.</p>";
      return;
    }

    const fragment = document.createDocumentFragment();
    data.images.forEach(image => {
      const container = document.createElement("div");
      container.classList.add("photo-container");
      container.innerHTML = `
        <img src="https://drive.google.com/thumbnail?id=${image.id}" alt="${image.name}" class="fade-in">
        <div class="selection-circle"></div>
      `;
      container.onclick = () => toggleImageSelection(container, image.id);
      fragment.appendChild(container);
    });

    gallery.innerHTML = "";
    gallery.appendChild(fragment);
  } catch (error) {
    gallery.innerHTML = "<p>Erro ao carregar as imagens. Tente novamente mais tarde.</p>";
  } finally {
    isProcessing = false;
  }
}

// Alterna a seleção de imagens
function toggleImageSelection(container, imageId) {
  container.classList.toggle("selected");
  if (container.classList.contains("selected")) {
    selectedImages.push(imageId);
  } else {
    selectedImages = selectedImages.filter(id => id !== imageId);
  }
}

// Envia selfie para comparação
async function uploadSelfie() {
  const fileInput = document.getElementById("fileInput");
  const cameraInput = document.getElementById("cameraInput");
  const file = cameraInput?.files[0] || fileInput?.files[0];

  if (!file) {
    alert("Selecione uma imagem para enviar.");
    return;
  }

  const albumId = new URLSearchParams(window.location.search).get("album");
  if (!albumId) {
    console.error("Nenhum albumId encontrado!");
    return;
  }

  const gallery = document.getElementById("image-gallery");
  gallery.innerHTML = '<div class="loader"></div>';

  try {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiRequest(`/albums/${albumId}/upload-selfie?max_faces=4096&threshold=70`, {
      method: "POST",
      body: formData
    });

    if (!data.matches || data.matches.length === 0) {
      gallery.innerHTML = "<p>Nenhuma correspondência encontrada.</p>";
      return;
    }

    displayMatchingImages(data.matches);
  } catch (error) {
    gallery.innerHTML = "<p>Erro ao processar sua imagem. Tente novamente mais tarde.</p>";
  }
}

// Exibe imagens correspondentes
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  const fragment = document.createDocumentFragment();
  matches.forEach(match => {
    const img = document.createElement("img");
    img.src = `https://drive.google.com/thumbnail?id=${match.image_id}`;
    img.alt = "";
    img.classList.add("fade-in");
    img.onclick = () => window.open(`https://drive.google.com/uc?id=${match.image_id}&export=download`, "_blank");
    fragment.appendChild(img);
  });

  gallery.innerHTML = "";
  gallery.appendChild(fragment);
}

// Inicializa eventos e carregamento
document.addEventListener("DOMContentLoaded", () => {
  const albumId = new URLSearchParams(window.location.search).get("album");
  if (albumId) {
    refreshAlbum(albumId);
  } else {
    loadAlbums();
  }

  // Carrega as imagens do álbum FotosCapas
  loadFotosCapas();

  document.getElementById("updateAlbumsBtn")?.addEventListener("click", debounce(loadAlbums, 300));
  document.getElementById("updateAlbumBtn")?.addEventListener("click", debounce(() => refreshAlbum(albumId), 300));
});

// Expõe funções globalmente
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
window.loadFotosCapas = loadFotosCapas;
