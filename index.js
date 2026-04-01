const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const sizeOf = require('image-size');

// ⚠️ ضع هنا توكن بوتك الجديد من @BotFather
const bot = new Telegraf('8754193792:AAGNEbrQ6GBdc87BLI4LTHzqtJ609sh8WX4');

// ذاكرة مؤقتة لحفظ الصور لكل مستخدم
const userImages = {};

bot.start((ctx) => {
    ctx.reply(`أهلاً بك يا مبرمج علي 👨‍💻 في بوت PDF المطور.\n\n📸 أرسل صورة (مرة واحدة) لإضافتها، ويمكنك إرسال عدة صور.\Delta\n✅ عند الانتهاء، اضغط على زر "تحويل" لتحصل على ملف PDF.`);
});

// 1. استقبال الصور وحفظها كمقاطع
bot.on('photo', async (ctx) => {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    
    // إذا لم يكن للمستخدم مصفوفة صور، ننشئها
    if (!userImages[ctx.from.id]) {
        userImages[ctx.from.id] = [];
    }

    // حفظ آيدي الملف
    userImages[ctx.from.id].push(fileId);
    
    const count = userImages[ctx.from.id].length;
    ctx.reply(`🖼️ تم حفظ الصورة (الرقم: ${count}). أرسل صورة أخرى أو اضغط تحويل.`, 
    Markup.keyboard([['🔄 تحويل إلى PDF', '🗑️ مسح الكل']]).resize());
});

// 2. معالجة "التحويل" و "المسح"
bot.hears(['🔄 تحويل إلى PDF', '🗑️ مسح الكل'], async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text === '🗑️ مسح الكل') {
        delete userImages[userId];
        return ctx.reply('🗑️ تم مسح القائمة بنجاح.', Markup.removeKeyboard());
    }

    // التحويل إلى PDF
    if (!userImages[userId] || userImages[userId].length === 0) {
        return ctx.reply('⚠️ يرجى إرسال صورة واحدة على الأقل أولاً!');
    }

    const statusMsg = await ctx.reply('⏳ جاري إنشاء ملف PDF... (قد يستغرق وقتاً حسب عدد الصور).');
    const imagesIds = userImages[userId];
    const pdfPath = `Ali_File_${userId}.pdf`; // اسم الملف النهائي

    try {
        // إنشاء وثيقة PDF جديدة (A4)
        const doc = new PDFDocument({ size: 'A4', autoFirstPage: false });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // إضافة الصور للصفحات
        for (let i = 0; i < imagesIds.length; i++) {
            const fileLink = await ctx.telegram.getFileLink(imagesIds[i]);
            
            // تحميل الصورة مؤقتاً
            const imageResponse = await axios({ method: 'get', url: fileLink.href, responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);

            // الحصول على أبعاد الصورة لضبطها داخل الصفحة
            const dimensions = sizeOf(imageBuffer);
            
            // إضافة صفحة جديدة لكل صورة
            doc.addPage();
            
            // وضع الصورة في الصفحة (مع توسيط وضبط المقاس)
            doc.image(imageBuffer, 0, 0, {
                fit: [595, 842], // مقاس صفحة A4
                align: 'center',
                valign: 'center'
            });
        }

        // إنهاء الوثيقة
        doc.end();

        // إرسال ملف الـ PDF للمستخدم
        stream.on('finish', async () => {
            await ctx.telegram.sendDocument(ctx.chat.id, {
                source: pdfPath,
                filename: `File_by_Ali_${userId}.pdf`
            }, {
                caption: `✅ تم تحويل ${imagesIds.length} صور إلى PDF بنجاح!\n\nبواسطة: @${ctx.botInfo.username}`
            });

            // حذف ملف الـ PDF المؤقت من السيرفر
            fs.unlinkSync(pdfPath);
            delete userImages[userId];
            ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
            ctx.reply('📩 ملفك جاهز!', Markup.removeKeyboard());
        });

    } catch (e) {
        console.error(e);
        ctx.reply('❌ حدث خطأ غير متوقع أثناء إنشاء ملف الـ PDF.');
        delete userImages[userId];
    }
});

bot.launch();
