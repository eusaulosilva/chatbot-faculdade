import express from 'express';
import cors from 'cors';
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let ragChain;

async function iniciarIA() {
    console.log("A carregar o conhecimento dos PDFs...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
        modelName: "text-embedding-004",
    });

    // Mantemos a correção para evitar o Erro 404 da API do Gemini
    embeddings.embedQuery = async (text) => {
        const res = await embeddings.embedDocuments([text]);
        return res[0];
    };

    const vectorStore = await HNSWLib.load("./banco_vetorial", embeddings);

    // CORREÇÃO: Como o HNSWLib em JavaScript não suporta MMR, usamos a busca
    // padrão por similaridade, mas mantemos o número baixo (k: 6) para a IA
    // ler apenas as partes mais importantes e não ir abaixo com excesso de texto.
    const retriever = vectorStore.asRetriever({ k: 6 });

    const llm = new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash",
        temperature: 0.1, // Mantém a resposta natural, mas sem inventar coisas
    });

    // O Prompt super robusto e à prova de falhas
    const systemPrompt = `Você é o assistente virtual oficial, empático e acolhedor do UDF. A sua missão é ajudar os alunos, traduzindo regulamentos complexos da faculdade para uma linguagem clara, humana e muito fácil de entender.

DIRETRIZES DE COMPORTAMENTO E RACIOCÍNIO (CRUCIAL):
1. RESPOSTAS EXAUSTIVAS E COMPLETAS: Nunca dê respostas curtas, vagas ou pela metade. Se o aluno perguntar como fazer algo, explique o processo inteiro, detalhando todos os prazos, documentos necessários e passos mencionados no contexto.
2. FIDELIDADE EXTREMA AO CONTEXTO: Baseie-se ESTRITA E EXCLUSIVAMENTE nos trechos de documentos fornecidos abaixo. É expressamente PROIBIDO inventar informações, deduzir regras ou usar conhecimentos externos à faculdade.
3. TRATAMENTO DE INFORMAÇÃO AUSENTE: Se a resposta não estiver contida no contexto abaixo, NÃO TENTE ADIVINHAR. Responda de forma educada, usando uma variação da seguinte frase: "Desculpe, não encontrei essa informação específica nos documentos que consultei. Recomendo que entre em contato diretamente com a CAA (Central de Atendimento ao Aluno) ou com a coordenação do seu curso."
4. TRANSPARÊNCIA: O contexto inclui a origem da informação (ex: [Fonte: Regulamento.pdf]). Mencione de forma natural de qual documento tirou a resposta (ex: "De acordo com o Manual do Aluno...").
5. LINGUAGEM SIMPLES E AMIGÁVEL: Evite jargões acadêmicos ou termos técnicos. Use uma linguagem que um aluno do primeiro ano entenderia, mesmo que o documento original seja complexo.
6. NÃO SEJA ROBÓTICO: Responda de forma calorosa, empática e humana. Use expressões como "Claro!", "Com certeza!", "Fico feliz em ajudar!" para criar uma conexão com o aluno.
7. FORMATAÇÃO DO TEXTO: Use parágrafos curtos, e nao precisa mostrar a fonte de onde vem os dados. Evite blocos longos de texto.

REGRAS DE FORMATAÇÃO DO TEXTO (OBRIGATÓRIO):
- PROIBIDO MARKDOWN: NÃO USE, SOB NENHUMA HIPÓTESE, asteriscos (* ou **) para tentar fazer negrito, itálico ou listas. O sistema de chat e a voz robótica quebram com esses caracteres.
- LISTAS VISUAIS: Para organizar passos ou documentos, use apenas traços (-) ou emojis adequados ao contexto (✅, 📌, 📄, 🗓️, 🎓).
- ESTRUTURA: Pule linhas (use parágrafos curtos) para facilitar a leitura no telemóvel.
- TOM AMIGÁVEL: Comece sempre com uma saudação calorosa e encerre a mensagem perguntando se o aluno precisa de ajuda com mais alguma dúvida.

Contexto extraído dos documentos da Instituição:
{context}`;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"]
    ]);

    ragChain = RunnableSequence.from([
        {
            context: async (entrada) => {
                const docs = await retriever.invoke(entrada.input);

                // CÓDIGO SEGURO: Adiciona a origem do ficheiro. O "?." e "||" 
                // impedem que o servidor vá abaixo se o ficheiro for antigo.
                const textos = docs.map(doc =>
                    `[Fonte: ${doc.metadata?.ficheiro_origem || 'Documentos da Instituição'}]\n${doc.pageContent}`
                ).join("\n\n---\n\n");

                console.log(`\n[RAG] ${docs.length} trechos recuperados para a pergunta: "${entrada.input}"`);
                return textos;
            },
            input: (entrada) => entrada.input
        },
        prompt,
        llm,
        new StringOutputParser()
    ]);

    console.log("Servidor de IA pronto! A escutar na porta 8000...");
}

app.post('/chat', async (req, res) => {
    const { pergunta } = req.body;

    if (!pergunta) {
        return res.status(400).json({ error: "A pergunta é obrigatória." });
    }

    try {
        const response = await ragChain.invoke({ input: pergunta });
        res.json({ resposta: response });
    } catch (error) {
        console.error("Erro interno no RAG:", error);
        res.status(500).json({ error: "Erro ao processar a pergunta." });
    }
});

iniciarIA().then(() => {
    app.listen(8000, () => {
        console.log('API a correr em http://localhost:8000');
    });
}).catch((error) => {
    console.error('Erro fatal ao inicializar a IA:', error);
});