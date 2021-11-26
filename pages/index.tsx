import { useMemo, useState, useEffect, useCallback, ReactNode, FC } from 'react';
import Image from 'next/image'
import { NextPage } from 'next'
import { ethers } from 'ethers'

const IPFS_HASH = 'QmNQNLZW5d3EgJnNsHDjVLB9Yjai8sTaXSUn3LS1uV2baJ';
const CITIZEN_NFT_CONTRACT_ADDRESS = '0x7eef591a6cc0403b9652e98e88476fe1bf31ddeb';
const CITIZEN_NFT_IDS = [7, 42, 69];
const GITHUB_APPROVALS_URL = 'https://github.com/davidfant/constitution-approvals';

interface StepProps {
  index: number;
  label: ReactNode;
  cta?: string;
  active: boolean;
  enabled?: boolean;
  onClick?(): void;
}

const Step: FC<StepProps> = ({index, label, cta, active, enabled, onClick}) => {
  return (
    <div className={`step ${active ? 'step-active' : ''}`}>
      <span className="step-index">{index + 1}</span>
      {typeof label === 'string' ? <p className="step-content">{label}</p> : <div className="step-content">{label}</div>}
      <div className="step-cta">
        {active && enabled && <button onClick={onClick}>{cta}</button>}
      </div>
    </div>
  );
}

const Home: NextPage = () => {
  const [constitution, setConstitution] = useState<string>();
  const [stepIndex, setStepIndex] = useState(0);
  const [address, setAddress] = useState<string>();
  const [nftCount, setNftCount] = useState<number>();
  const [approvalUrl, setApprovalUrl] = useState<string>();

  useEffect(() => {
    fetch(`https://ipfs.io/ipfs/${IPFS_HASH}`)
      .then((res) => res.text())
      .then(setConstitution);
  }, []);

  const provider = useMemo(
    () =>
      typeof window !== 'undefined'
      ? new ethers.providers.Web3Provider((window as any).ethereum, 'mainnet')
      : undefined,
    []);
  const citizenContract = useMemo(() => new ethers.Contract(
    CITIZEN_NFT_CONTRACT_ADDRESS,
    require('./contract.json').abi,
    provider,
  ), [provider]);

  const connectWallet = useCallback(async () => {
    if (!provider) return;
    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    if (!address) return;
    
    const balances = await citizenContract.balanceOfBatch(
      CITIZEN_NFT_IDS.map(() => address),
      CITIZEN_NFT_IDS,
    );
    const count = balances.map(Number).reduce((a: number, b: number) => a + b, 0);

    setNftCount(count);
    setAddress(address);
    setStepIndex(1);
  }, [citizenContract, provider]);

  const submitSignature = useCallback(async (payload: any, signature: string) => {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({payload, signature, address}),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => res.json());
    setApprovalUrl(response.url);
    setStepIndex(3);
  }, [address]);

  const approveConstitution = useCallback(async () => {
    if (!provider) return;
    const payload = {
      message: 'I approve the CityDAO constitution',
      ipfsHash: IPFS_HASH,
    };

    const signature = await provider.send(
      'personal_sign',
      [address, JSON.stringify(payload)],
    );

    setStepIndex(2);
    submitSignature(payload, signature);
  }, [address, submitSignature, provider]);

  return (
    <main>
      <h1 className="text-center">
        <span className="color-primary">CityDAO</span> Constitution
      </h1>
      <p className="text-center mt-1">
        Here you can read the CityDAO constitution. If you hold Citizen NFTs you can vote to approve the constitution at the bottom of the page. All approval votes are stored on <a href={GITHUB_APPROVALS_URL} target="_blank" rel="noreferrer">our repo on Github</a>.
      </p>

      <section className="constitution-container">
        {!!constitution && (
          <p>
            {constitution}
          </p>
        )}

      </section>
      <section className="text-center">
        <p className="opacity-50">
          This constitution is stored forever on <a target="_blank" href={`https://ipfs.io/ipfs/${IPFS_HASH}`} rel="noreferrer">IPFS</a>
        </p>
        <a target="_blank" href={`https://ipfs.io/ipfs/${IPFS_HASH}`} className="text-sm text-italic opacity-50" rel="noreferrer">
          IPFS hash: {IPFS_HASH}
        </a>
      </section>


      <div className="steps-container">
        <Step
          index={0}
          label="Connect wallet with Citizen NFTs"
          cta="Metamask"
          enabled
          active={stepIndex === 0}
          onClick={connectWallet}
        />
        <Step
          index={1}
          label={(
            <div>
              <p>
                Approve the CityDAO Constitution (Citizen NFTs needed)
              </p>
              <p className="text-sm text-italic opacity-50">
                When approving the constitution, you will sign a message with the constitution IPFS hash, and the message signature will be stored in <a href={GITHUB_APPROVALS_URL}
                target="_blank" rel="noreferrer">this Github project</a>
              </p>
            </div>
          )}
          cta={`Approve (${nftCount} ${nftCount === 1 ? 'NFT' : 'NFT2'})`}
          enabled={!!nftCount}
          active={stepIndex === 1}
          onClick={approveConstitution}
        />
        <Step
          index={2}
          label={stepIndex === 2 ? 'Submitting vote...' : 'Submit vote'}
          active={stepIndex === 2}
        />
        <Step
          index={3}
          label={(
            <div>
              <p>
                Done
              </p>
              {!!approvalUrl && (
                <p className="text-sm text-italic opacity-50">
                  See your approval and signature <a href={approvalUrl} target="_blank" rel="noreferrer">here</a>
                </p>
              )}
            </div>
          )}
          active={stepIndex === 3}
        />
      </div>
    </main>
  )
}

export default Home
