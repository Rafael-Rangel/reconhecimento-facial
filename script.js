//const API_URL = "https://cors-anywhere.herokuapp.com/http://3.12.76.155:8000/api";
const API_URL = "https://projetofotografo.zapto.org/api";
// autorização 1hr: https://cors-anywhere.herokuapp.com/corsdemo
 
let imageMap = {}; // Mapeamento ID -> Nome da imagem
let isProcessing = false; // Evita chamadas duplicadas no álbum
let isLoadingAlbums = false; // Evita múltiplas chamadas ao carregar álbuns

// ✅ Verifica se o álbum existe antes de carregar
async function checkAndLoadAlbum(albumId) {
    if (!albumId) {
        console.warn("⚠️ Nenhum albumId fornecido!");
        alert("Álbum inválido! Retornando à página inicial.");
        window.location.href = "index.html"; 
        return;
    }

    try {
        console.log(`🚀 Verificando existência do álbum: ${albumId}...`);

        const response = await fetch(`${API_URL}/albums/${albumId}`);

        if (!response.ok) {
            console.warn(`🚨 Álbum não encontrado! Código: ${response.status}`);

            if (response.status === 404) {
                alert("Este álbum não existe ou foi excluído!");
                window.location.href = "index.html"; // Redireciona para a página principal
                return;
            }

            throw new Error(`Erro ao verificar álbum (Status: ${response.status})`);
        }

        console.log("✅ Álbum encontrado! Carregando imagens...");
        refreshAlbum(albumId); // Agora podemos carregar as imagens com segurança

    } catch (error) {
        console.error("🚨 Erro ao verificar o álbum:", error);
        alert("Erro ao verificar álbum. Tente novamente mais tarde.");
        window.location.href = "index.html";
    }
}

// 🔄 Atualiza e carrega imagens corretamente, com VERIFICAÇÃO SE O ÁLBUM EXISTE
let isAlbumDeleted = false; // 🔥 Flag para evitar loop infinito

async function refreshAlbum(albumId, forceUpdate = false) {
    if (isProcessing && !forceUpdate) {
        console.warn("⚠️ Já está processando! Ignorando nova chamada.");
        return;
    }
    if (isAlbumDeleted) {
        console.warn("🚨 O álbum foi excluído. Não faremos novas tentativas.");
        return;
    }

    isProcessing = true;

    try {
        console.log("🔄 Iniciando refreshAlbum para albumId:", albumId);
        if (!albumId) {
            console.warn("⚠️ Nenhum albumId encontrado na URL!");
            return;
        }

        const gallery = document.getElementById("image-gallery");
        if (!gallery) {
            console.warn("⚠️ Elemento #image-gallery não encontrado!");
            return;
        }

        gallery.classList.add("loading");
    

        // 🔥 Verifica primeiro se o álbum existe
        let response = await fetch(`${API_URL}/albums/${albumId}/images`);
        
        if (!response.ok) {
            console.warn("🚨 O álbum não existe ou foi excluído! Código:", response.status);

            if (response.status === 404) {
                isAlbumDeleted = true; // 🔥 Marca que o álbum foi excluído

                gallery.innerHTML = `<p style="color: red;">Este álbum foi excluído ou não existe.</p>`;
                
                setTimeout(() => {
                    window.location.href = "index.html"; // 🔄 Redireciona para a página inicial
                }, 3000);

                return;
            }

            throw new Error(`Erro ao carregar álbum (Status: ${response.status})`);
        }

        let data = await response.json();

        if (Array.isArray(data.images) && data.images.length > 0) {
            console.log("📸 Imagens carregadas com sucesso!");
            displayImages(data.images);
        } else {
            console.warn("⚠️ Nenhuma imagem encontrada.");
            gallery.innerHTML = "<p>Nenhuma imagem disponível.</p>";
        }
    } catch (error) {
        console.error("🚨 Erro ao atualizar o álbum:", error);
    } finally {
        isProcessing = false;
        const gallery = document.getElementById("image-gallery");
        if (gallery) gallery.classList.remove("loading");
        
    }
}


// ✅ Inicia o carregamento ao abrir a página **COM VERIFICAÇÃO SE O ÁLBUM EXISTE**
document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
        console.log("🖼️ Carregando lista de álbuns...");
        loadAlbums();
    } else {
        console.log("🚀 Página carregada dentro de um álbum, verificando existência...");

        if (!isProcessing) {
            isProcessing = true; // ✅ Define antes de chamar
         
        } else {
            console.warn("⚠️ Ignorando chamada duplicada de refreshAlbum.");
        }
    }
});




// 🖼️ Exibe imagens conforme forem carregando
function displayImages(images) {
    const gallery = document.getElementById("image-gallery");
    if (!gallery) return;

    gallery.innerHTML = ""; // Limpa a galeria antes de carregar as novas imagens
    imageMap = {};

    images.forEach(image => {
        imageMap[image.id] = image.name;

        const img = document.createElement("img");
        img.src = `https://drive.google.com/thumbnail?id=${image.id}`;
        img.alt = image.name;
        img.loading = "lazy";
        img.classList.add("fade-in");
        img.onclick = () => window.open(image.url, "_blank");

        gallery.appendChild(img);
    });

    console.log("✅ Imagens carregadas com sucesso!");
}

// 🔄 Envia selfie e busca rostos similares
async function uploadSelfie(inputId) {
  const fileInput = document.getElementById(inputId);
  if (!fileInput || !fileInput.files.length) {
    alert("Selecione uma imagem para enviar.");
    return;
  }

  const file = fileInput.files[0];
  const albumId = new URLSearchParams(window.location.search).get("album");

  if (!albumId) {
    console.error("⚠️ Nenhum albumId encontrado!");
    return;
  }

  try {
    console.log("📤 Enviando selfie para comparação...");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/albums/${albumId}/upload-selfie?max_faces=5&threshold=70`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      console.error("❌ Erro ao enviar selfie:", response.status);
      alert("Erro ao enviar selfie. Tente novamente.");
      return;
    }

    const data = await response.json();
    console.log("🤖 Resultado da API:", data);

    if (!data.matches || data.matches.length === 0) {
      console.warn("⚠️ Nenhuma imagem similar encontrada.");
      document.getElementById("image-gallery").innerHTML = "<p>Nenhuma correspondência encontrada.</p>";
      return;
    }

    // Reaproveite a função de exibir imagens (já existente no seu script)
    displayMatchingImages(data.matches);
  } catch (error) {
    console.error("🚨 Erro ao enviar selfie:", error);
  }
}


// 🔄 Exibe os rostos mais similares encontrados
function displayMatchingImages(matches) {
    const gallery = document.getElementById("image-gallery");
    if (!gallery) return;

    gallery.innerHTML = "<h3>Imagens Similares Encontradas:</h3>";

    matches.forEach(match => {
        const img = document.createElement("img");
        img.src = `https://drive.google.com/thumbnail?id=${match.image_id}`;
        img.alt = `Similaridade: ${match.similarity.toFixed(2)}%`;
        img.loading = "lazy";
        img.classList.add("fade-in");
        img.onclick = () => window.open(`https://drive.google.com/uc?id=${match.image_id}&export=download`, "_blank");

        const info = document.createElement("p");
        info.innerText = `Similaridade: ${match.similarity.toFixed(2)}%`;

        gallery.appendChild(img);
        gallery.appendChild(info);
    });

    console.log("✅ Imagens similares carregadas!");
}


// 🔄 Exibe os rostos mais similares encontrados
function displayMatchingImages(matches) {
    const gallery = document.getElementById("image-gallery");
    if (!gallery) return;

    gallery.innerHTML = "<h3>Imagens Similares Encontradas:</h3>";

    if (!Array.isArray(matches) || matches.length === 0) {
        console.warn("⚠️ Nenhuma imagem similar encontrada.");
        gallery.innerHTML += "<p>Nenhuma imagem correspondente.</p>";
        return;
    }

    matches.forEach(match => {
        const img = document.createElement("img");
        img.src = `https://drive.google.com/thumbnail?id=${match.image_id}`;
        img.alt = `Similaridade: ${match.similarity}%`;
        img.loading = "lazy";
        img.classList.add("fade-in");
        img.onclick = () => window.open(`https://drive.google.com/uc?id=${match.image_id}&export=download`, "_blank");

        const info = document.createElement("p");
        info.innerText = `Similaridade: ${match.similarity.toFixed(2)}%`;

        gallery.appendChild(img);
        gallery.appendChild(info);
    });

    console.log("✅ Imagens similares carregadas!");
}

// 🔄 Carrega os álbuns **APENAS SE NÃO ESTIVER SENDO CARREGADO**
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

    try {
        console.log("📂 Buscando álbuns...");
        const response = await fetch(`${API_URL}/main/folders`);

        if (!response.ok) {
            console.warn(`⚠️ Erro na API: ${response.status}`);
            throw new Error("Erro ao carregar álbuns.");
        }

        const data = await response.json();
        console.log("📂 Álbuns recebidos:", data);

        albumContainer.innerHTML = "";

        if (!Array.isArray(data.folders) || data.folders.length === 0) {
            console.warn("⚠️ Nenhum álbum encontrado!");
            albumContainer.innerHTML = "<p>Nenhum álbum disponível.</p>";
            return;
        }

        data.folders.forEach(album => {
            const albumCard = document.createElement("div");
            albumCard.classList.add("album-card");
            albumCard.innerText = album.name;
            albumCard.onclick = () => window.location.href = `album.html?album=${album.id}`;

            albumContainer.appendChild(albumCard);
        });

        console.log("✅ Álbuns exibidos com sucesso!");
    } catch (error) {
        console.error("🚨 Erro ao carregar álbuns:", error);
        albumContainer.innerHTML = "<p>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
    } finally {
        isLoadingAlbums = false; // 🔥 Libera para futuras chamadas apenas quando terminar
    }
}

// ✅ Inicia o carregamento ao abrir a página **SOMENTE SE FOR NECESSÁRIO**
document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
        console.log("🖼️ Carregando lista de álbuns...");
        loadAlbums(); // 🚀 Agora é chamado apenas uma vez corretamente
    } else {
        console.log("🚀 Página carregada dentro de um álbum, tentando atualizar...");
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

// 📤 Expõe funções globalmente para evitar erro "loadAlbums is not defined"
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
