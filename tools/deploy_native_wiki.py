#!/usr/bin/env python3
"""Guard Wiki replacement on an already verified native Core."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

WIKI="dorks-and-dice-rules-wiki"
CORE="dorks-and-dice-rules-core-private"
PUBLIC="dorks-and-dice-rules-core"
BACKEND="dorks-and-dice-backend"
FINGERPRINT="870ca5e89a97b9176f0a3b55fb6cb9467227d13562a83dd7d72ecee5a57ecda6"

def require(value,message):
    if not value:
        raise RuntimeError(message)

def command(*args,env=None):
    result=subprocess.run(args,text=True,capture_output=True,env=env)
    require(result.returncode==0,f"Command failed: {args[0]} {args[1]} (exit {result.returncode}); inspect privately")
    return result.stdout

def inspect(kind,name):
    return json.loads(command("docker",kind,"inspect",name))[0]

def validate(config):
    require(set(config["services"])=={"rules-wiki"},"Unexpected Wiki service set")
    wiki=config["services"]["rules-wiki"]
    require(not wiki.get("ports") and not wiki.get("volumes"),"Wiki ports/mounts are prohibited")
    require(set(wiki.get("networks",{}))=={BACKEND,"rules-core-private-tunnel"},"Wiki network mismatch")
    require(wiki.get("environment",{}).get("RulesCorePrivate__BaseUrl")==f"http://{CORE}:8080","Wiki must target the reviewed private ingress")
    return config["networks"]["rules-core-private-tunnel"]["name"]

def probe(network,host,path,method="GET"):
    body=[] if method=="GET" else ["-H","Content-Type: application/json","--data",'{"arguments":[]}']
    result=command("docker","run","--rm","--network",network,"curlimages/curl:8.12.1",
                   "--connect-timeout","2","--max-time","5","-sS","-o","/dev/null","-w","%{http_code}","-X",method,
                   *body,f"http://{host}:8080{path}")
    return result.strip()

def preflight():
    sha=os.environ.get("RELEASE_SHA","")
    require(bool(re.fullmatch("[0-9a-f]{40}",sha)),"RELEASE_SHA must be exact")
    env_file=os.environ.get("RULES_WIKI_ENV_FILE","")
    require(Path(env_file).is_file(),"Wiki deployment .env is missing")
    image="dorks-and-dice-rules-wiki:rewrite-"+sha
    env={**os.environ,"RULES_WIKI_IMAGE":image}
    compose=["docker","compose","--project-name",WIKI,"--env-file",env_file,
             "-f","docker-compose.yml","-f","docker-compose.private-tunnel.yml"]
    config=json.loads(command(*compose,"config","--format","json",env=env))
    pair=validate(config)
    core=inspect("container",CORE)
    require(core["State"]["Running"],"Native Core must be running first")
    core_env=dict(item.split("=",1) for item in core["Config"].get("Env",[]) if "=" in item)
    require(core_env.get("RulesCore__ApiSurface")=="PrivateOnly","Core must be PrivateOnly")
    require(pair in core["NetworkSettings"]["Networks"] and BACKEND not in core["NetworkSettings"]["Networks"],"Core private isolation is incorrect")
    require(not core["HostConfig"].get("PortBindings"),"Private Core publishes host ports")
    revision=inspect("image",core["Image"])["Config"].get("Labels",{}).get("org.opencontainers.image.revision","")
    require(bool(re.fullmatch("[0-9a-f]{40}",revision)),"Core is not a commit-labeled rewrite release")
    require(inspect("container",PUBLIC)["Image"]==core["Image"],"Core ingress images differ")
    require(FINGERPRINT in command("docker","logs",CORE),"Native catalog fingerprint mismatch")
    require(probe(pair,CORE,"/ready")=="200","Core catalog is not ready")
    require(probe(pair,CORE,"/api/private/rulesets")=="401","Core anonymous private access is not denied")
    require(probe(pair,CORE,"/api/rulesets")=="404","Core public/private separation failed")
    names=set(command("docker","ps","-a","--format","{{.Names}}").splitlines())
    if WIKI in names:
        previous=inspect("container",WIKI)
        require(previous["Config"].get("Labels",{}).get("com.docker.compose.project")==WIKI,"Wiki name belongs to another project")
    print("Native Core prerequisite passed; genuine Site-ticket acceptance remains pending",flush=True)
    return image,env,compose,pair

def verify(image_id,pair):
    wiki=inspect("container",WIKI)
    require(wiki["Image"]==image_id,"Wiki release image mismatch")
    require(set(wiki["NetworkSettings"]["Networks"])=={BACKEND,pair},"Running Wiki network mismatch")
    require(not wiki["HostConfig"].get("PortBindings"),"Running Wiki publishes ports")
    require(wiki["State"]["Running"] and not wiki["State"].get("OOMKilled"),"Wiki exited or was OOM-killed")
    require(probe(BACKEND,WIKI,"/_rules-wiki/operations/getNativeRulesets","POST")=="401","Unauthenticated Wiki operation was not rejected")

def deploy():
    image,env,compose,pair=preflight()
    image_id=inspect("image",image)["Id"]
    try:
        command(*compose,"up","-d","--no-build","--no-deps","rules-wiki",env=env)
        for attempt in range(30):
            try:
                if probe(BACKEND,WIKI,"/ready")=="200":
                    break
            except RuntimeError:
                pass
            if attempt==29:
                raise RuntimeError("Wiki did not become process-ready")
            time.sleep(2)
        verify(image_id,pair)
        restart=inspect("container",WIKI)["RestartCount"]
        for _ in range(6):
            time.sleep(10)
            verify(image_id,pair)
            require(inspect("container",WIKI)["RestartCount"]==restart,"Wiki restarted during observation")
        print(json.dumps({"status":"wiki-infrastructure-smoke-passed","imageId":image_id,
                          "liveSiteTicketAcceptance":"pending","browserAcceptance":"pending"}),flush=True)
    except Exception:
        try:
            current=inspect("container",WIKI)
        except RuntimeError:
            current={}
        if current.get("Image")==image_id:
            command("docker","stop","--time","15",WIKI)
        raise

if __name__=="__main__":
    try:
        require(len(sys.argv)==2 and sys.argv[1] in {"preflight","deploy"},"Expected preflight or deploy")
        preflight() if sys.argv[1]=="preflight" else deploy()
    except (RuntimeError,KeyError,ValueError,OSError) as error:
        print(f"Native Wiki release stopped: {error}",file=sys.stderr)
        sys.exit(1)
