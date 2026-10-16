const ENDPOINT = 'https://formsubmit.co/ajax/chenzhe223@gamil.com';

(async () => {
  const payload = {
    _subject: '[DAVYLAB 系统测试] 邮件表单首次激活，请忽略',
    _template: 'table',
    _honey: '',
    '需求类型': '系统测试',
    '需求描述': '这是 DAVYLAB 网站所有者发起的一次邮件转发服务激活测试，不是客户需求，无需回复，也不包含真实客户资料。',
    '称呼': 'DAVYLAB 自动化测试',
    '联系方式类型': '其他',
    '联系方式': '系统测试，无需回复',
    '预算': '不适用',
    '期望时间': '不适用',
    '联系授权': '仅用于测试邮件转发链路'
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000)
    });
    const raw = await response.text();
    let result = {};
    try { result = JSON.parse(raw); } catch { /* omit raw body to avoid leaking service details */ }
    const success = response.ok &&
      result.success !== false &&
      result.success !== 'false';

    console.log(JSON.stringify({
      check: 'FormSubmit activation request',
      http_status: response.status,
      service_accepted: success,
      response_message: typeof result.message === 'string' ? result.message.slice(0, 240) : 'No message field returned',
      note: 'Provider acceptance does not prove final inbox delivery. The recipient may need to click the first-time activation link.'
    }, null, 2));
    if (!success) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({
      check: 'FormSubmit activation request',
      service_accepted: false,
      error: error && error.message ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  }
})();
