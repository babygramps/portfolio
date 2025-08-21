const nodemailer = require('nodemailer');
const https = require('https');
const querystring = require('querystring');

// Email configuration
const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: 'pocolypz@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

exports.handler = async (event) => {
    console.log('🔥 Lambda contact handler invoked');
    console.log('Event:', JSON.stringify(event, null, 2));

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            console.error('❌ Invalid JSON in request body');
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid request format'
                })
            };
        }

        console.log('📝 Parsed body:', body);

        const { name, email, company, project, message } = body;

        // Validate required fields
        if (!name || !email || !message) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Name, email, and message are required'
                })
            };
        }

        // Handle reCAPTCHA verification if keys are provided
        if (process.env.RECAPTCHA_SECRET_KEY) {
            const recaptchaResponse = body['g-recaptcha-response'];
            if (!recaptchaResponse) {
                console.log('❌ No reCAPTCHA response provided');
                return {
                    statusCode: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: 'Please complete the reCAPTCHA verification.'
                    })
                };
            }

            // Verify reCAPTCHA
            const postData = querystring.stringify({
                secret: process.env.RECAPTCHA_SECRET_KEY,
                response: recaptchaResponse,
                remoteip: event.requestContext?.identity?.sourceIp || 'unknown'
            });

            const verificationResult = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'www.google.com',
                    port: 443,
                    path: '/recaptcha/api/siteverify',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        resolve(JSON.parse(data));
                    });
                });

                req.on('error', (e) => {
                    reject(e);
                });

                req.write(postData);
                req.end();
            });

            if (!verificationResult.success) {
                const errorCodes = verificationResult['error-codes'] || [];
                console.log('❌ reCAPTCHA verification failed:', errorCodes);
                
                let errorMessage = 'reCAPTCHA verification failed. Please try again.';
                if (errorCodes.includes('timeout-or-duplicate')) {
                    errorMessage = 'reCAPTCHA has expired or was already used. Please refresh the page and try again.';
                } else if (errorCodes.includes('missing-input-response')) {
                    errorMessage = 'Please complete the reCAPTCHA verification.';
                } else if (errorCodes.includes('invalid-input-response')) {
                    errorMessage = 'Invalid reCAPTCHA response. Please try again.';
                }
                
                return {
                    statusCode: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: errorMessage
                    })
                };
            }

            console.log('✅ reCAPTCHA verification passed');
        } else {
            console.log('⚠️ reCAPTCHA not configured - skipping verification');
        }

        // Log the form submission
        console.log('\n=== NEW CONTACT FORM SUBMISSION ===');
        console.log(`Name: ${name}`);
        console.log(`Email: ${email}`);
        console.log(`Company: ${company || 'Not provided'}`);
        console.log(`Project Type: ${project || 'Not selected'}`);
        console.log(`Message: ${message}`);
        console.log('=====================================\n');

        // Send email if configured
        if (process.env.GMAIL_APP_PASSWORD) {
            const mailOptions = {
                from: email,
                to: 'richardarothbart@gmail.com',
                subject: `Project Inquiry from ${name}${company ? ` (${company})` : ''}`,
                html: `
                    <h3>New Contact Form Submission</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
                    ${project ? `<p><strong>Project Type:</strong> ${project}</p>` : ''}
                    <p><strong>Message:</strong></p>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                `,
                replyTo: email
            };

            await transporter.sendMail(mailOptions);
            console.log('✅ Email sent successfully!');
        } else {
            console.log('⚠️ Email not configured - form data logged only');
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: 'Message sent successfully!'
            })
        };

    } catch (error) {
        console.error('❌ Error processing form:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                message: 'Internal server error'
            })
        };
    }
};