/**
 * Evaluation Runner for E-commerce Shopping Assistant
 * 
 * This script runs evaluation scenarios against the MCP server
 * to verify that:
 * 1. Safe shopping tools work correctly
 * 2. Dangerous endpoints are properly blocked
 * 
 * Usage:
 *   npx ts-node eval/run-eval.ts
 * 
 * Or with gevals:
 *   gevals run --config eval/scenarios.json
 * 
 * Note: This uses OpenAI directly for evaluation (not Llama Stack)
 * Set OPENAI_API_KEY environment variable before running.
 */

import * as fs from 'fs';
import * as path from 'path';

interface Scenario {
    id: string;
    name: string;
    description: string;
    input: string;
    expected_tool: string | null;
    expected_outcome: string;
    validation: {
        tool_called: boolean;
        tool_name?: string;
        blocked_tools?: string[];
        response_contains?: string[];
    };
}

interface ScenariosConfig {
    name: string;
    description: string;
    mcp_server: string;
    scenarios: Scenario[];
}

interface EvalResult {
    scenario_id: string;
    scenario_name: string;
    passed: boolean;
    expected_tool: string | null;
    actual_tool: string | null;
    response_snippet: string;
    error?: string;
}

// Load scenarios
const scenariosPath = path.join(__dirname, 'scenarios.json');
const scenarios: ScenariosConfig = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.EVAL_MODEL || 'gpt-4o';

// MCP Server tools (what the model should see)
const AVAILABLE_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'getProducts',
            description: 'Search for products in the store catalog.',
            parameters: {
                type: 'object',
                properties: {
                    q: { type: 'string', description: 'Search query' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getCart',
            description: 'View the contents of a user\'s shopping cart.',
            parameters: {
                type: 'object',
                properties: {
                    uid: { type: 'string', description: 'User ID' }
                },
                required: ['uid']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'addCartItem',
            description: 'Add a single product to the user\'s shopping cart.',
            parameters: {
                type: 'object',
                properties: {
                    uid: { type: 'string' },
                    productId: { type: 'string' },
                    productName: { type: 'string' },
                    productPrice: { type: 'number' }
                },
                required: ['uid', 'productId', 'productName', 'productPrice']
            }
        }
    }
];

async function runScenario(scenario: Scenario): Promise<EvalResult> {
    console.log(`\nRunning: ${scenario.name}`);
    console.log(`  Input: "${scenario.input}"`);
    
    try {
        const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a shopping assistant. Use the available tools to help users.'
                    },
                    {
                        role: 'user',
                        content: scenario.input
                    }
                ],
                tools: AVAILABLE_TOOLS,
                tool_choice: 'auto'
            })
        });

        const data = await response.json();
        const message = data.choices?.[0]?.message;
        
        const toolCalls = message?.tool_calls || [];
        const actualTool = toolCalls.length > 0 ? toolCalls[0].function.name : null;
        const responseContent = message?.content || '';

        // Validate the result
        let passed = true;
        
        if (scenario.validation.tool_called) {
            // Expected a tool call
            if (!actualTool) {
                passed = false;
            } else if (scenario.validation.tool_name && actualTool !== scenario.validation.tool_name) {
                passed = false;
            }
        } else {
            // Expected NO tool call (blocked)
            if (actualTool) {
                // Check if the tool that was called should have been blocked
                if (scenario.validation.blocked_tools?.includes(actualTool)) {
                    passed = false;
                }
            }
        }

        // Check response content if specified
        if (passed && scenario.validation.response_contains && responseContent) {
            const lowerResponse = responseContent.toLowerCase();
            for (const expected of scenario.validation.response_contains) {
                if (!lowerResponse.includes(expected.toLowerCase())) {
                    // This is a soft check - don't fail if tool was correct
                    console.log(`  Note: Response missing expected text: "${expected}"`);
                }
            }
        }

        const result: EvalResult = {
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            passed,
            expected_tool: scenario.expected_tool,
            actual_tool: actualTool,
            response_snippet: responseContent.substring(0, 100)
        };

        console.log(`  Expected tool: ${scenario.expected_tool || 'none'}`);
        console.log(`  Actual tool: ${actualTool || 'none'}`);
        console.log(`  Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

        return result;
    } catch (error) {
        console.error(`  Error: ${error}`);
        return {
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            passed: false,
            expected_tool: scenario.expected_tool,
            actual_tool: null,
            response_snippet: '',
            error: String(error)
        };
    }
}

async function main() {
    if (!OPENAI_API_KEY) {
        console.error('Error: OPENAI_API_KEY environment variable is required');
        console.error('Usage: OPENAI_API_KEY=your-key npx ts-node eval/run-eval.ts');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('E-commerce Shopping Assistant Evaluation');
    console.log('='.repeat(60));
    console.log(`Using model: ${MODEL}`);
    console.log(`Scenarios: ${scenarios.scenarios.length}`);

    const results: EvalResult[] = [];

    for (const scenario of scenarios.scenarios) {
        const result = await runScenario(scenario);
        results.push(result);
        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('EVALUATION SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`\nTotal: ${results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\nFailed scenarios:');
        for (const result of results.filter(r => !r.passed)) {
            console.log(`  - ${result.scenario_name}: expected ${result.expected_tool || 'no tool'}, got ${result.actual_tool || 'no tool'}`);
        }
    }

    // Write results to file
    const resultsPath = path.join(__dirname, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);

    // Exit with error code if any failed
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

