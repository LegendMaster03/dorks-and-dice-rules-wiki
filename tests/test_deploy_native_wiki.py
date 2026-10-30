import importlib.util
from pathlib import Path
import unittest
import json
import os
import tempfile
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("release",Path(__file__).parents[1]/"tools/deploy_native_wiki.py")
release=importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
class WikiReleaseBoundaryTests(unittest.TestCase):
    def config(self):
        return {"services":{"rules-wiki":{"networks":{release.BACKEND:{},"rules-core-private-tunnel":{}},
                "environment":{"RulesCorePrivate__BaseUrl":f"http://{release.CORE}:8080"}}},
                "networks":{"rules-core-private-tunnel":{"name":"pair"}}}
    def test_accepts_reviewed_topology(self):
        self.assertEqual("pair",release.validate(self.config()))
    def test_rejects_ports_mounts_and_public_core_target(self):
        for key,value in [("ports",["8080:8080"]),("volumes",["data:/data"])]:
            config=self.config(); config["services"]["rules-wiki"][key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError): release.validate(config)
        config=self.config()
        config["services"]["rules-wiki"]["environment"]["RulesCorePrivate__BaseUrl"]=f"http://{release.PUBLIC}:8080"
        with self.assertRaises(RuntimeError): release.validate(config)
    def test_rejects_extra_service_or_network(self):
        config=self.config(); config["services"]["postgres"]={}
        with self.assertRaises(RuntimeError): release.validate(config)
        config=self.config(); config["services"]["rules-wiki"]["networks"]["database"]={}
        with self.assertRaises(RuntimeError): release.validate(config)

    def test_preflight_allows_changed_catalog_fingerprint(self):
        # Native content changes independently of the Wiki release. Core
        # readiness and isolation must remain mandatory; a historic digest
        # must not block a valid new catalog.
        with tempfile.TemporaryDirectory() as directory:
            env_file=Path(directory)/"wiki.env"
            env_file.write_text("")
            revision="b"*40
            def fake_command(*args,env=None):
                if "config" in args:
                    return json.dumps(self.config())
                if args[:3]==("docker","ps","-a"):
                    return ""
                if args[:3]==("docker","logs",release.CORE):
                    return "Native rules catalog ready: ruleset first-party-001, records 400, fingerprint "+("9"*64)
                raise AssertionError(f"Unexpected command: {args}")
            def fake_inspect(kind,name):
                if (kind,name)==("container",release.CORE):
                    return {"State":{"Running":True},
                            "Config":{"Env":["RulesCore__ApiSurface=PrivateOnly"]},
                            "NetworkSettings":{"Networks":{"pair":{}}},
                            "HostConfig":{"PortBindings":None},"Image":"sha256:core"}
                if (kind,name)==("container",release.PUBLIC):
                    return {"Image":"sha256:core"}
                if (kind,name)==("image","sha256:core"):
                    return {"Config":{"Labels":{"org.opencontainers.image.revision":revision}}}
                raise AssertionError(f"Unexpected inspect: {kind} {name}")
            def fake_probe(network,host,path,method="GET"):
                return {"/ready":"200","/api/private/rulesets":"401",
                        "/api/rulesets":"404"}[path]
            with patch.dict(os.environ,{"RELEASE_SHA":"a"*40,"RULES_WIKI_ENV_FILE":str(env_file)}), \
                 patch.object(release,"command",side_effect=fake_command), \
                 patch.object(release,"inspect",side_effect=fake_inspect), \
                 patch.object(release,"probe",side_effect=fake_probe):
                image,_,_,pair=release.preflight()
                self.assertEqual("pair",pair)
                self.assertEqual("dorks-and-dice-rules-wiki:rewrite-"+("a"*40),image)
if __name__=="__main__": unittest.main()
