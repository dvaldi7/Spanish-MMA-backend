const pool = require('../config/db');
const slugify = require('slugify');


const getNews = async (req, res) => {

    try {
        const [rows] = await pool.query('SELECT * FROM news ORDER BY published_at DESC');

        res.json(rows);

    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Error al obtener las noticias",
        })
    }
}

const createNews = async (req, res) => {

const { title, content } = req.body;

const slug = slugify(title, { lower: true, strict: true });

let image_url = null;
    if (req.file) {
        image_url = `images/news/${req.file.filename}`;
    }

    try {
        const sqlQuery = `
            INSERT INTO news (
                title, content, image_url, slug 
            ) 
            VALUES (?, ?, ?, ?)
        `;
        const [ result ] = await pool.query(sqlQuery, [
            title, 
            content, 
            image_url, 
            slug, 
        ]);

        res.status(201).json({
            status: "success",
            message: "Noticia creada con éxito",
            news_id: result.insertId,
            image_url: image_url,
            slug: slug,
        })

    } catch (error) {
        // Manejo específico para slugs duplicados
        if (error.code === 'ER_DUP_ENTRY') {
            // Si el slug ya existe, le añadimos un timestamp para que sea único
            slug = `${slug}-${Date.now()}`;
            return res.status(400).json({ 
                message: "Ya existe una noticia con un título similar, por favor cámbialo un poco." 
            });
        }
        console.error("Error: ", error);
        res.status(500).json({
            status: "error",
            message: "error al crear la noticia",
        })
    }
}




module.exports = {
    getNews,
    createNews,
}