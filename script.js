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
    const data = await apiRequest("/main/folders");
    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      albumContainer.innerHTML = "<p>Nenhum álbum disponível.</p>";
      return;
    }

    const fragment = document.createDocumentFragment();
    data.folders.forEach(album => {
      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");
      albumCard.innerHTML = `
        <img src="https://placehold.co/300x200?text=Carregando..." alt="Capa do Álbum" class="album-cover">
        <h3>${album.name}</h3>
      `;
      albumCard.onclick = () => window.location.href = `album.html?album=${album.id}`;
      fragment.appendChild(albumCard);

      // Carrega a capa do álbum de forma assíncrona
      apiRequest(`/albums/${album.id}/images`).then(imagesData => {
        const coverImg = albumCard.querySelector(".album-cover");

        // Busca a imagem de capa com base no nome "fotocapa" e extensões comuns
        const fotoCapa = imagesData.images?.find(img => {
          const lowerName = img.name.toLowerCase();
          return lowerName.startsWith("fotocapa") && (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png"));
        });

        // Adiciona logs para depuração
        console.log(`Álbum ID: ${album.id}`);
        console.log(`Imagens retornadas:`, imagesData.images);
        if (fotoCapa) {
          console.log(`Imagem de capa encontrada:`, fotoCapa);
          console.log(`Link da imagem de capa: https://drive.google.com/thumbnail?id=${fotoCapa.id}`);
        } else {
          console.log(`Nenhuma imagem de capa encontrada para o álbum ${album.id}`);
        }

        coverImg.src = fotoCapa
          ? `https://drive.google.com/thumbnail?id=${fotoCapa.id}`
          : "https://placehold.co/300x200?text=Sem+Capa";
      }).catch(error => {
        console.error(`Erro ao carregar imagens do álbum ${album.id}:`, error);
        albumCard.querySelector(".album-cover").src = "https://placehold.co/300x200?text=Erro+Capa";
      });
    });

    albumContainer.innerHTML = "";
    albumContainer.appendChild(fragment);
  } catch (error) {
    albumContainer.innerHTML = "<p>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
  } finally {
    isLoadingAlbums = false;
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

  document.getElementById("updateAlbumsBtn")?.addEventListener("click", debounce(loadAlbums, 300));
  document.getElementById("updateAlbumBtn")?.addEventListener("click", debounce(() => refreshAlbum(albumId), 300));
});

// Expõe funções globalmente
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
