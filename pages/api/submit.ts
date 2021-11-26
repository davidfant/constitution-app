import { NextApiRequest, NextApiResponse } from 'next'
import * as path from 'path'
import fs from 'fs'
import SimpleGitPromise, { SimpleGit } from 'simple-git/promise';
import * as Ethers from 'ethers';
import * as Joi from 'joi';

const GIT_REPO_URL = 'https://github.com/davidfant/constitution-approvals';

const requestSchema = Joi.object().keys({ 
  address: Joi.string().required(),
  signature: Joi.string().required(),
  payload: Joi.object().required(),
}); 

interface RequestData {
  address: string;
  signature: string;
  payload: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(404).json({ ok: false });
  }

  const validation = requestSchema.validate(req.body);
  if (validation.error) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  const signer = Ethers.utils.verifyMessage(
    JSON.stringify(req.body.payload),
    req.body.signature,
  );

  if (signer.toUpperCase() !== req.body.address.toUpperCase()) {
    return res.status(400).json({ ok: false, error: 'Invalid signature' });
  }

  const gitRepoPath = path.join(process.cwd(), `constitution-approvals/${Date.now()}`);
  try {
    await SimpleGitPromise().clone(GIT_REPO_URL, gitRepoPath);
    const git: SimpleGit = SimpleGitPromise(gitRepoPath);

    const fileName = `approvals/${req.body.address}.txt`;
    fs.writeFileSync(`${gitRepoPath}/${fileName}`, JSON.stringify({
      address: req.body.address,
      signature: req.body.signature,
      payload: req.body.payload,
    }, null, 2));

    await git.add('./*');
    await git.commit(req.body.address);
    await git.push('origin', 'master');

    fs.rmdirSync(gitRepoPath, { recursive: true });
    res.status(200).json({
      ok: true,
      body: req.body,
      url: `${GIT_REPO_URL}/blob/master/${fileName}`,
    });
  } catch (error) {
    fs.rmdirSync(gitRepoPath, { recursive: true });
    return res.status(500).json({ ok: false, error });
  }
}
