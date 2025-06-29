// indexar-albums.js
const API_URL = "https://dev.uvfotoevideo.com.br/api";

// Função para fazer requisições (compatível com Node.js)
async function apiRequest(endpoint, options = {}) {
  // Importa fetch dinamicamente para Node.js
  const fetch = (await import('node-fetch')).default;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos timeout

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Requisição cancelada por timeout');
    }
    
    throw error;
  }
}

async function indexarTodosAlbuns() {
  console.log("🚀 Iniciando indexação de todos os álbuns...");
  console.log(`⏰ Horário: ${new Date().toISOString()}`);
  
  try {
    // 1. Buscar todos os álbuns
    console.log("📁 Buscando lista de álbuns...");
    const data = await apiRequest("/main/folders");
    
    if (!Array.isArray(data.folders)) {
      throw new Error("Formato de resposta inválido - folders não é um array");
    }

    // 2. Filtrar álbuns (remover FotosCapas)
    const albumsParaIndexar = data.folders.filter(album => 
      album.name.trim().toLowerCase() !== "fotoscapas"
    );
    
    console.log(`📊 Encontrados ${albumsParaIndexar.length} álbuns para indexar:`);
    albumsParaIndexar.forEach((album, index) => {
      console.log(`   ${index + 1}. "${album.name}" (ID: ${album.id})`);
    });
    
    if (albumsParaIndexar.length === 0) {
      console.log("⚠️  Nenhum álbum encontrado para indexar");
      return { total: 0, sucessos: 0, erros: 0, albums: [] };
    }
    
    // 3. Indexar cada álbum
    let sucessos = 0;
    let erros = 0;
    const resultados = [];
    
    for (let i = 0; i < albumsParaIndexar.length; i++) {
      const album = albumsParaIndexar[i];
      const progresso = `[${i + 1}/${albumsParaIndexar.length}]`;
      
      console.log(`\n${progresso} 🔄 Indexando: "${album.name}"`);
      console.log(`${progresso} 📋 ID: ${album.id}`);
      
      const inicioTempo = Date.now();
      
      try {
        await apiRequest(`/albums/${album.id}/process-images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const tempoGasto = ((Date.now() - inicioTempo) / 1000).toFixed(1);
        sucessos++;
        
        console.log(`${progresso} ✅ "${album.name}" indexado com sucesso (${tempoGasto}s)`);
        
        resultados.push({
          id: album.id,
          name: album.name,
          status: 'success',
          tempo: tempoGasto + 's'
        });
        
      } catch (error) {
        const tempoGasto = ((Date.now() - inicioTempo) / 1000).toFixed(1);
        erros++;
        
        console.error(`${progresso} ❌ Erro ao indexar "${album.name}" (${tempoGasto}s):`, error.message);
        
        resultados.push({
          id: album.id,
          name: album.name,
          status: 'error',
          error: error.message,
          tempo: tempoGasto + 's'
        });
      }
      
      // Aguarda entre cada álbum para não sobrecarregar a API
      if (i < albumsParaIndexar.length - 1) {
        console.log(`${progresso} ⏳ Aguardando 5 segundos antes do próximo...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // 4. Relatório final
    console.log("\n" + "=".repeat(50));
    console.log("📊 RELATÓRIO FINAL DA INDEXAÇÃO");
    console.log("=".repeat(50));
    console.log(`⏰ Finalizado em: ${new Date().toISOString()}`);
    console.log(`📁 Total de álbuns: ${albumsParaIndexar.length}`);
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`📈 Taxa de sucesso: ${((sucessos / albumsParaIndexar.length) * 100).toFixed(1)}%`);
    
    if (erros > 0) {
      console.log("\n❌ ÁLBUNS COM ERRO:");
      resultados
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   • "${r.name}" (${r.id}): ${r.error}`);
        });
    }
    
    if (sucessos > 0) {
      console.log("\n✅ ÁLBUNS INDEXADOS COM SUCESSO:");
      resultados
        .filter(r => r.status === 'success')
        .forEach(r => {
          console.log(`   • "${r.name}" (${r.tempo})`);
        });
    }
    
    console.log("=".repeat(50));
    console.log("🎉 Indexação completa!");
    
    return {
      total: albumsParaIndexar.length,
      sucessos,
      erros,
      taxaSucesso: ((sucessos / albumsParaIndexar.length) * 100).toFixed(1) + '%',
      albums: resultados,
      horarioInicio: new Date().toISOString(),
      horarioFim: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("\n💥 ERRO CRÍTICO NA INDEXAÇÃO:");
    console.error("Tipo:", error.name);
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}

// Executar se for chamado diretamente
if (typeof window === 'undefined') {
  indexarTodosAlbuns()
    .then(resultado => {
      console.log("\n🏁 Script finalizado com sucesso!");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n💀 Script finalizado com erro:", error.message);
      process.exit(1);
    });
}

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { indexarTodosAlbuns };
}
