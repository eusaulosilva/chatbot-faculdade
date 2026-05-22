import React, { useState } from 'react';

function App() {
  const [pergunta, setPergunta] = useState('');
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Função que transforma o texto em áudio
  const falarTexto = (texto) => {
    if ('speechSynthesis' in window) {
      // Para qualquer áudio que estiver tocando antes de começar o novo
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR'; // Define a voz para Português do Brasil
      utterance.rate = 1.0;     // Velocidade da fala
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Seu navegador não suporta a leitura de voz.");
    }
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!pergunta.trim()) return;

    const novaMensagemUsuario = { autor: 'aluno', texto: pergunta };
    setMensagens((prev) => [...prev, novaMensagemUsuario]);
    setPergunta('');
    setCarregando(true);

    try {
      // Envia a pergunta para a nossa API Python
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: novaMensagemUsuario.texto }),
      });

      const data = await response.json();
      const respostaBot = { autor: 'bot', texto: data.resposta };

      setMensagens((prev) => [...prev, respostaBot]);

      // Assim que a mensagem aparece na tela, o bot fala em voz alta
      falarTexto(data.resposta);

    } catch (error) {
      console.error("Erro na conexão:", error);
      setMensagens((prev) => [...prev, { autor: 'bot', texto: "Erro ao conectar com o servidor." }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Assistente Virtual da Faculdade</h2>

      {/* Caixa de chat */}
      <div style={{ border: '1px solid #ddd', height: '450px', overflowY: 'auto', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
        {mensagens.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.autor === 'aluno' ? 'right' : 'left', margin: '10px 0' }}>
            <span style={{
              background: msg.autor === 'aluno' ? '#007bff' : '#f1f1f1',
              color: msg.autor === 'aluno' ? '#fff' : '#333',
              padding: '10px 15px',
              borderRadius: '15px',
              display: 'inline-block',
              maxWidth: '80%'
            }}>
              {msg.texto}
            </span>
          </div>
        ))}
        {carregando && <div style={{ textAlign: 'left', color: '#888' }}>Digitando e processando áudio...</div>}
      </div>

      {/* Input e Botão */}
      <form onSubmit={enviarMensagem} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="O que você quer saber sobre o material?"
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
          disabled={carregando}
        />
        <button
          type="submit"
          disabled={carregando}
          style={{ padding: '12px 24px', borderRadius: '8px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

export default App;