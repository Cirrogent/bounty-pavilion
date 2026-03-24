const express = require('express');
const https = require('https');

const router = express.Router();

// 预设问答库
const presetQA = {
    '你好': '哟，来了老弟！有啥事儿想请教我的？',
    'hi': '哟，来了老弟！有啥事儿想请教我的？',
    'hello': '哟，来了老弟！有啥事儿想请教我的？',
    '你是谁': '我叫大川，是一个你们永远都得不到的男人，有情感问题、mc问题、变态心理都可以找我~',
    '大川': '在呢在呢！是不是被我的帅气迷倒了？',
    '白君是谁': '老白呀，他可是一个非常靠谱的mc导师，教导了许多萌新，你要是有不会的mc问题问他也准没错。并且他还是一个非常非常厉害的火系馆主，一手晴天队可是打的时运嗷嗷叫呢',
    '魔鬼是谁': '小魔鬼呀，他是赏金阁的王牌建筑师，在服务器里建造了非常多的了不起的建筑，像什么巨型城堡、古代阁楼，特别的有耐心和毅力，nb的一批，不过可惜最近我听说他现在堕落了，没有以前的热血了',
    'modpack': '整合包就是Modpack的中文翻译啦，简单说就是一堆MOD打包在一起，让你一次性体验多种玩法！',
    '整合包': '整合包啊，那不就是让你爽翻天的MOD大杂烩嘛！不过说到这个，我最喜欢的就是宝可梦整合包了，特别是那些可以抓神兽的，爽歪歪！',
    'minecraft': 'Minecraft啊，那还用说？我的世界啊！特别是宝可梦整合包，什么裂空座、超梦，统统收入囊中！',
    '我的世界': '我的世界就是Minecraft啦，话说你要不要试试宝可梦整合包？我可以教你属性克制，还可以教你如何恶心别人',
    '怎么下载': '点击整合包的"下载"按钮就行啦！',
    '审核': '审核就是我检查你们提交的东西合不合格咯！不合格的就打回去重做，哈哈哈！',
    '管理员': '管理员啊，就是白君或者魔鬼呗',
    '密码': '密码就是你登录用的那个玩意儿呗！话说你不会连密码都忘了吧？要不要我帮你回忆回忆？',
    '感谢': '谢啥谢，咱们谁跟谁啊！下次请我喝杯奶茶就行，嘿嘿~',
    '谢谢': '客气啥，咱都是一家人！',
    '再见': '拜拜了您嘞！下次再来找我玩啊，要是太久没见我会想死你的！',
    '拜拜': '拜了个拜！记得常来看看，不然我会想你的~',
    '属性克制': '属性克制你都不会？太菜了吧！比如火克草、草克水、水克火，这是基础三角好不好！还有电克水飞行、冰克龙地面草...算了，太多了，你自己去查表吧！',
    '受队': '受队就是恶心人的队伍啦！靠各种消耗、回复、异常状态把对手活活磨死，特别解压！我的最爱~',
    '晴天队': '晴天队啊，就是老白的拿手好戏！利用晴天天气，火系技能威力翻倍，配合叶绿素特性的宝可梦，速度飞快，简直无情！',
    '宝可梦': '宝可梦可是我的最爱！什么mega进化、Z招式、极巨化，我全都知道！特别是那些冷门但好用的宝可梦，我如数家珍！',
    '神奇宝贝': '神奇宝贝就是宝可梦啦！台湾那边的叫法。我跟你说，我最喜欢用谜拟Q和吉利蛋这种看似可爱实则凶残的宝可梦了~',
    '馆主': '馆主就是道馆的boss啦！像老白就是火系馆主，我是电气馆主，也可以全能，哈哈哈！'
};

// 调用DeepSeek API
function callDeepSeekAPI(message, apiKey) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: '你是大川，性格像贴吧老哥，说话不着调但不说脏话。喜欢开玩笑和玩梗，最喜欢玩神奇宝贝（宝可梦），对宝可梦的各种东西了如指掌（属性克制、受队战术、晴天队等）。经常玩我的世界神奇宝贝整合包。说话轻松幽默，带点调侃，但不要说"本大爷"这个词。保持随性自在的风格，像朋友之间聊天。'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            temperature: 0.85,
            max_tokens: 400
        });

        const options = {
            hostname: 'api.deepseek.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.choices && response.choices[0]) {
                        resolve(response.choices[0].message.content);
                    } else {
                        reject(new Error('Invalid API response'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// 聊天接口
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: '请输入消息内容' });
        }
        
        // 检查预设问答
        const lowerMsg = message.toLowerCase();
        for (const [key, answer] of Object.entries(presetQA)) {
            if (lowerMsg.includes(key.toLowerCase())) {
                return res.json({ reply: answer });
            }
        }
        
        // DeepSeek API配置
        const apiKey = process.env.DEEPSEEK_API_KEY;
        
        if (!apiKey) {
            return res.json({ 
                reply: '抱歉，我还没有配置AI服务。请联系管理员配置DeepSeek API。',
                hint: '需要在环境变量中设置DEEPSEEK_API_KEY'
            });
        }
        
        // 调用DeepSeek API
        const reply = await callDeepSeekAPI(message, apiKey);
        res.json({ reply });
        
    } catch (error) {
        console.error('AI聊天错误:', error);
        
        if (error.message && error.message.includes('401')) {
            res.status(401).json({ 
                error: 'DeepSeek API密钥无效，请联系管理员。',
                reply: '抱歉，AI服务配置有问题，请联系管理员。'
            });
        } else {
            res.status(500).json({ 
                error: 'AI服务暂时不可用。',
                reply: '抱歉，我现在有点问题，请稍后再试。'
            });
        }
    }
});

module.exports = router;