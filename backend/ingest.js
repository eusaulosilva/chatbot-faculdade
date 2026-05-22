import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import * as dotenv from "dotenv";

dotenv.config();

async function processarPDF() {
    try {
        console.log("1. A carregar o PDF...");
        const loader = new PDFLoader("./assests/1779463563881_UDF_MANUAL_DO_ALUNO_2025.pdf");
        const docs = await loader.load();

        // O sumário (índice) nas primeiras páginas "rouba" os resultados da busca porque tem todas as palavras-chave.
        // Removemos as páginas de 1 a 4 para a IA pesquisar apenas o conteúdo real.
        const docsSemSumario = docs.filter(doc => doc.metadata.loc.pageNumber >= 5);

        console.log("2. A dividir o texto em pedaços...");
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await textSplitter.splitDocuments(docsSemSumario);

        console.log("3. A criar a base de dados vetorial...");
        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
        });

        const vectorStore = await HNSWLib.fromDocuments(chunks, embeddings);
        await vectorStore.save("./banco_vetorial");

        console.log("Sucesso! O PDF foi processado e aprendido.");
    } catch (error) {
        console.error("Erro ao processar o PDF:", error);
    }
}

processarPDF();